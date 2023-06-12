const express = require('express')
const cors = require('cors')
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

//middlewares
const corsConfig = {
  credentials:true,
  origin:true,
  methods: ["GET","POST","PATCH","PUT","DELETE","OPTIONS"]
}
app.use(cors(corsConfig));
app.use(express.json())

// response
app.get('/', (req,res)=>{
    res.send("running beta........")
})


app.listen(port)