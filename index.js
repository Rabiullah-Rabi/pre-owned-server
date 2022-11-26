const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 1357;

// middlewares
app.use(cors());
app.use(express.json());
//verify jwt
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, function (error, decoded) {
    if (error) {
      return res.status(403).send("Forbidden");
    }
    req.decoded = decoded;
    next();
  });
}
// Database Connection
const uri = process.env.DB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const usersCollection = client.db("pre-owned").collection("users");
    const categoryCollection = client.db("pre-owned").collection("category");
    const productCollection = client.db("pre-owned").collection("product");
    const bookedCollection = client.db("pre-owned").collection("booked-items");
    // save user info
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      // generate jwt token
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });
      res.send({ result, token });
    });
    //user info by email
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const categories = await usersCollection.findOne(query);
      res.send(categories);
    });
    //all users
    app.get("/users", async (req, res) => {
      const query = {};
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    //verify user
    app.put("/verify-users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          verified: true,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    //delete a user
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });
    // all categories
    app.get("/categories", async (req, res) => {
      const query = {};
      const result = await categoryCollection.find(query).toArray();
      res.send(result);
    });
    // Products By Category
    app.get("/categories/:name", async (req, res) => {
      const name = req.params.name;
      const query = { category: name };
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });
    //get products
    app.get("/products", async (req, res) => {
      const query = {};
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });
    //get product details
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });
    //add product
    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });
    //all buyers
    app.get("/buyers", async (req, res) => {
      const query = { role: "buyer" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    //all Sellers
    app.get("/sellers", async (req, res) => {
      const query = { role: "seller" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    //save booked items
    app.post('/booked', async (req, res) => {
      const product = req.body;
      const result = await bookedCollection.insertOne(product);
      res.send(result);
    })
  } finally {
  }
}

run().catch((err) => console.error(err));

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running`);
});
