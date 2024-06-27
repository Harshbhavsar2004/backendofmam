const express = require("express");
const router = new express.Router();
const userdb = require("../models/userSchema");
const authenticate = require("../middleware/authenticate");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Score = require("../models/Score"); // Import the Score model

const keysecret = process.env.SECRET_KEY; // JWT Token secret key

// email config
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create Cloudinary storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: (req, file) => {
            if (file.fieldname === 'photo') {
                return 'images/photos';
            } else if (file.fieldname === 'sign') {
                return 'images/signs';
            } else {
                throw new Error('Invalid field name');
            }
        },
        public_id: (req, file) => file.originalname,
    }
});

// Initialize Multer with Cloudinary storage
const upload = multer({ storage: storage });

// Register route
router.post('/register', upload.fields([{ name: 'photo' }, { name: 'sign' }]), async (req, res) => {
    const { fname, lname, email, phone, dob, course, batch, gender, nationality, password, cpassword } = req.body;
    let photo = null;
    let sign = null;

    if (req.files && req.files.photo && req.files.photo.length > 0) {
        photo = req.files.photo[0].path; // Cloudinary file URL
    }

    if (req.files && req.files.sign && req.files.sign.length > 0) {
        sign = req.files.sign[0].path; // Cloudinary file URL
    }

    if (!fname || !lname || !email || !phone || !dob || !course || !batch || !gender || !nationality || !password || !cpassword) {
        return res.status(422).json({ error: 'Fill all the details' });
    }

    try {
        const preuser = await userdb.findOne({ email: email });

        if (preuser) {
            return res.status(422).json({ error: 'This Email is Already Exist' });
        } else if (password !== cpassword) {
            return res.status(422).json({ error: 'Password and Confirm Password Not Match' });
        } else {
            const finalUser = new userdb({
                fname,
                lname,
                email,
                phone,
                dob,
                course,
                batch,
                gender,
                nationality,
                password,
                cpassword,
                photo,
                sign
            });

            const storeData = await finalUser.save();
            
            // Generate token
            const token = jwt.sign({ _id: storeData._id }, keysecret, {
                expiresIn: "1d"
            });
            
            console.log(storeData);
            return res.status(201).json({ status: 201, storeData, token });
        }
    } catch (error) {
        console.error('catch block error:', error);
        return res.status(422).json(error);
    }
});

// user Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(422).json({ error: "Fill All The Details" });
    }

    try {
        const userValid = await userdb.findOne({ email: email });

        if (userValid) {
            if (password !== userValid.password) {
                res.status(422).json({ error: "Invalid Credentials" });
            } else {
                // token generate
                const token = await userValid.generateAuthtoken();

                // cookiegenerate
                res.cookie("usercookie", token, {
                    expires: new Date(Date.now() + 9000000),
                    httpOnly: true
                });

                const result = {
                    userValid,
                    token
                };
                res.status(201).json({ status: 201, result });
            }
        } else {
            res.status(401).json({ status: 401, message: "Invalid Credentials" });
        }

    } catch (error) {
        res.status(401).json({ status: 401, error });
        console.log("catch block");
    }
});

// user valid
router.get("/validuser", authenticate, async (req, res) => {
    try {
        const ValidUserOne = await userdb.findOne({ _id: req.userId });
        res.status(201).json({ status: 201, ValidUserOne });
    } catch (error) {
        res.status(401).json({ status: 401, error });
    }
});

// user logout
router.get("/logout", authenticate, async (req, res) => {
    try {
        console.log("Logout request received");
        console.log("Current user:", req.rootUser);
        console.log("Current token:", req.token);

        req.rootUser.tokens = req.rootUser.tokens.filter((curelem) => {
            return curelem.token !== req.token;
        });

        res.clearCookie("usercookie", { path: "/" });

        await req.rootUser.save();

        res.status(201).json({ status: 201 });
    } catch (error) {
        console.error("Error during logout:", error);
        res.status(401).json({ status: 401, error });
    }
});


// send email Link For reset Password
router.post("/sendpasswordlink", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        res.status(401).json({ status: 401, message: "Enter Your Email" });
    }

    try {
        const userfind = await userdb.findOne({ email: email });

        // token generate for reset password
        const token = jwt.sign({ _id: userfind._id }, keysecret, {
            expiresIn: "120s"
        });

        const setusertoken = await userdb.findByIdAndUpdate({ _id: userfind._id }, { verifytoken: token }, { new: true });

        if (setusertoken) {
            const mailOptions = {
                from: process.env.EMAIL,
                to: email,
                subject: "Sending Email For password Reset",
                text: `This Link is Valid For 2 MINUTES ${process.env.BASE_URL}/forgotpassword/${userfind.id}/${setusertoken.verifytoken}`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log("error", error);
                    res.status(401).json({ status: 401, message: "Email Not Send" });
                } else {
                    console.log("Email sent", info.response);
                    res.status(201).json({ status: 201, message: "Email Sent Successfully" });
                }
            });
        }
    } catch (error) {
        res.status(401).json({ status: 401, message: "Invalid User" });
    }
});

// verify user for forgot password time
router.get("/forgotpassword/:id/:token", async (req, res) => {
    const { id, token } = req.params;

    try {
        const validuser = await userdb.findOne({ _id: id, verifytoken: token });

        const verifyToken = jwt.verify(token, keysecret);

        if (validuser && verifyToken._id) {
            res.status(201).json({ status: 201, validuser });
        } else {
            res.status(401).json({ status: 401, message: "User Not Exist" });
        }
    } catch (error) {
        res.status(401).json({ status: 401, error });
    }
});

// change password
router.post("/:id/:token", async (req, res) => {
    const { id, token } = req.params;
    const { password } = req.body;

    try {
        const validuser = await userdb.findOne({ _id: id, verifytoken: token });
        const verifyToken = jwt.verify(token, keysecret);

        if (validuser && verifyToken._id) {
            const setnewuserpass = await userdb.findByIdAndUpdate({ _id: id }, { password: password });

            setnewuserpass.save();
            res.status(201).json({ status: 201, setnewuserpass });
        } else {
            res.status(401).json({ status: 401, message: "User Not Exist" });
        }
    } catch (error) {
        res.status(401).json({ status: 401, error });
    }
});



module.exports = router;
