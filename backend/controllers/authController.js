const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.registerUser = async (req,res)=>{
  const {name,email,password,role} = req.body;
  const hashed = await bcrypt.hash(password,10);
  db.query("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)",
    [name,email,hashed,role],
    (err,result)=>{
      if(err) return res.status(500).json(err);
      res.json({message:"User registered successfully"});
    });
};

exports.loginUser = (req,res)=>{
  const {email,password} = req.body;
  db.query("SELECT * FROM users WHERE email=?",[email], async (err,result)=>{
    if(err) return res.status(500).json(err);
    if(result.length===0) return res.status(400).json({message:"User not found"});
    const valid = await bcrypt.compare(password,result[0].password);
    if(!valid) return res.status(400).json({message:"Incorrect password"});
    const token = jwt.sign({user_id:result[0].user_id,role:result[0].role}, process.env.JWT_SECRET);
    res.json({token,user:result[0]});
  });
};
