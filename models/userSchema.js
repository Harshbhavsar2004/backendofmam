const mongoose = require("mongoose");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const keysecret = process.env.SECRET_KEY;

const userSchema = new mongoose.Schema({
    fname: {
        type: String,
        required: true,
        trim: true
    },
    lname: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        validate(value) {
            if (!validator.isEmail(value)) {
                throw new Error("not valid email");
            }
        }
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    dob: {
        type: Date,
        required: true,
    },
    course: {
        type: String,
        required: true,
    },
    batch: {
        type: String,
        required: true,
    },
    gender: {
        type: String,
        required: true,
    },
    nationality: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    cpassword: {
        type: String,
        required: true,
        minlength: 6
    },
    photo: {
        type: String,
        required: true
    },
    sign: {
        type: String,
        required: true
    },
    tokens: [
        {
            token: {
                type: String,
                required: true,
            }
        }
    ],
    verifytoken:{
        type: String,
    },
    Score: {
        type: Number,
        default: 0,
    }
});

// token generate
userSchema.methods.generateAuthtoken = async function () {
    try {
        let token23 = jwt.sign({ _id: this._id }, keysecret, {
            expiresIn: "1d"
        });

        this.tokens = this.tokens.concat({ token: token23 });
        await this.save();
        return token23;
    } catch (error) {
        res.status(422).json(error);
    }
}

// createing model
const userdb = new mongoose.model("users", userSchema);

module.exports = userdb;
