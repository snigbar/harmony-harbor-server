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



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.b9yxwfb.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");


    const classes = client.db("harmony").collection('classes')
    const users = client.db("harmony").collection('users')

    
    app.get('/', (req,res)=>{
        res.send("running beta........")
    })

    // get all classes

    app.get('/classes', async(req,res) =>{
      const result = await classes.find().sort({ enrolled: -1 }).toArray();
      const popularClasses = result
      res.send(popularClasses)
    })
    
    // get instructor
    app.get('/instructors', async(req,res) =>{
      const query = {role:'instructor'}
      const result = await users.find(query).sort({ students: -1 }).toArray();
      const instructors = result
      res.send(instructors)
    })
    
    // create a user
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const alreadyExist = await users.findOne(query);
  
      if (alreadyExist) {
        return res.send({ message: 'user exists' })
      }
      const result = await users.insertOne(user);
      res.send(result);
    });


  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`${port}`);
})
