require("dotenv").config();
const express = require("express");
const app = express();
require("./db/conn");
const router = require("./routes/router");
const cors = require("cors");
const cookiParser = require("cookie-parser")
const port = 3000;


// app.get("/",(req,res)=>{
//     res.status(201).json("server created")
// });

app.use(cors({ origin: process.env.BASE_URL , credentials: true }));
app.use(express.json());
app.use(cookiParser());
app.use(router);

app.listen(port,()=>{
    console.log(`server start at port no : ${port}`);
})

app.get("/",(req,res)=>{
    res.send("server created")
})


