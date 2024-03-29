require('dotenv').config()
const express = require('express')
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)


const app = express();
const cors = require('cors')
const corsOptions ={
  origin:'*', 
  credentials:true,
  optionSuccessStatus:200,
}

app.use(cors(corsOptions))
app.use(express.json())



// verify jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access not found header' });
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;

    next();
  })
}




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
  
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");


    const classes = client.db("harmony").collection('classes')
    const users = client.db("harmony").collection('users')
    const cart = client.db("harmony").collection('cart')
    const payments = client.db("harmony").collection('payments')

    
    app.get('/', (req,res)=>{
        res.send("running beta........")
    })

    // jwt token
      app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '2h' })
      res.send({ token })
      })

      // verify admin
      const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email }
        const user = await users.findOne(query);
        if (user?.role !== 'admin') {
          return res.status(403).send({ error: true, message: 'only admin can access' });
        }
        next();
      }

      // verify instructor
      const verifyInstructor = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email }
        const user = await users.findOne(query);
        if (user?.role !== 'instructor') {
          return res.status(403).send({ error: true, message: 'only instructors can access' });
        }
        next();
      }
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

    //get me

    app.get('/getme', verifyJWT, async(req,res) =>{
      const {email} = req.query
      const query = {email: email}
      const result = await users.findOne(query)
      res.send(result)
    })

    // addtocart

    app.post('/cart', async(req,res) =>{
      const data = req.body;
      const result = await cart.insertOne(data);
      res.send(result)
    })


  // get cart 
  app.get('/carts', verifyJWT, async(req,res)=>{
    const {email} = req.query;

    if(!email) return res.send([])


    const decodedEmail = req.decoded.email;

    if (email !== decodedEmail) {
      return res.status(403).send({ error: true, message: 'access not allowed' })
    }

    const query = {email: email}
    const result = await cart.find(query).toArray()
    res.send(result)
  })


  // get payment
  app.get('/payments', verifyJWT, async(req,res)=>{
    const {email} = req.query;

    if(!email) return res.send([])


    const decodedEmail = req.decoded.email;

    if (email !== decodedEmail) {
      return res.status(403).send({ error: true, message: 'access not allowed' })
    }

    const query = {email: email}
    const result = await payments.find(query).sort({ date: -1 }).toArray()
    res.send(result)
  })


// deleting a cart
  app.delete('/carts/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await cart.deleteOne(query);
    res.send(result)
  })

  // payment intent


   app.post('/create-payment-intent', verifyJWT, async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
    });

    res.send({
      clientSecret: paymentIntent.client_secret
    })
  
  })

  // store in data 

  app.post('/payments', verifyJWT, async (req, res) => {
    const payment = req.body;
    const insertResult = await payments.insertOne(payment);

    const query = { _id: new ObjectId(payment.cartId) }
    // console.log(query)
    const deleteResult = await cart.deleteOne(query)

    const filter = { _id: new ObjectId(payment.classId) }
    // decresed class
    let document = await classes.findOne(filter);
    let updateSeat;
    
    if (document && document.availableSeats > 0) {  
      document.availableSeats -= 1;
    if (document.availableSeats < 0) { 
      document.availableSeats = 0;
    }
    updateSeat = await classes.updateOne(filter, { $set: { availableSeats: document.availableSeats}, $inc: { enrolled: 1}});
    } 
    res.send({ insertResult, deleteResult, updateSeat});
  })

  // get admin
  app.get('/users/admin/:email', verifyJWT, async (req, res) => {
    const email = req.params.email;

    if (req.decoded.email !== email) {res.send({ admin: false })}

    const query = { email: email }
    const user = await users.findOne(query);
    const result = { admin: user?.role === 'admin' }
    res.send(result);
  })

  // get instructor
  app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
    const email = req.params.email;

    if (req.decoded.email !== email) {res.send({ instructor: false })}

    const query = { email: email }
    const user = await users.findOne(query);
    const result = { instructor: user?.role === 'instructor' }
    res.send(result);
  })

  // add a class
  app.post('/addclass', verifyJWT, verifyInstructor, async (req, res) => {
    const newItem = req.body;
    const result = await classes.insertOne(newItem)
    res.send(result);
  })

  // update a class
  app.patch('/updateclass/:id', async (req, res) => {
    const newItem = req.body;
    const {id} = req.params
    const query = {_id: new ObjectId(id)}
    const updateDoc = {
      $set: {
        ...newItem
      },
    };
    const result = await classes.updateOne(query, updateDoc)
    res.send(result);
  })

  // update a user
  app.patch('/updateuser/:email', async (req, res) => {
    const updatedUser = req.body;
    const {email} = req.params
    const query = {email:email}
    const updateDoc = {
      $set: {
        ...updatedUser
      },
    };
    const result = await users.updateOne(query, updateDoc)
    res.send(result);
  })

  // handle status
  app.patch('/admin/status/:id', async(req, res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const status = req.body.status
    const feedback = req.body.feedback
    const option = {
      $set: {
        status:status,
        feedback: feedback
      }
    }

    const result = await classes.updateOne(query,option)
    res.send(result);
 
  })

  // all users
  app.get('/admin/users', verifyJWT, verifyAdmin, async(req,res) =>{
    const result = await users.find().toArray();
    res.send(result)
  })

  // update user role
  app.patch('/admin/role/:id', async(req, res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const role = req.body.role
    const option = {
      $set: {
        role:role,
        students: 0
      }
    }
    const result = await users.updateOne(query,option)
    res.send(result);
 
  })

  // delete delete user
  app.delete('/admin/delete/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const user = await users.findOne(query);
    const filter = {instructorEmail: user.email}
    const result = await users.deleteOne(query);
    const classResult = await classes.deleteOne(filter);

    res.send(result)
  })


  } 
  finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`${port}`);
})
