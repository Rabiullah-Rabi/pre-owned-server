const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_KEY);

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
    const paymentsCollections = client.db("pre-owned").collection("payments");
    // Verify admin
    const verifyAdmin = async (req, res, next) => {
      console.log(req.decoded);
      const decodedEmail = req.decoded.email;
      console.log(decodedEmail);
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Access denied" });
      }
      next();
    };
    // Verify seller
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      console.log(decodedEmail);
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "seller") {
        return res.status(403).send({ message: "Access denied" });
      }
      next();
    };
    // Verify Buyer
    const verifyBuyer = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "buyer") {
        return res.status(403).send({ message: "Access denied" });
      }
      next();
    };
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
    app.get("/users", verifyJWT, async (req, res) => {
      const query = {};
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    //verify user
    app.put("/verify-users/:id", verifyJWT, verifyAdmin, async (req, res) => {
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
    app.delete("/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
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
    app.get("/all-products", async (req, res) => {
      const query = { sold: false };
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });
    //get product details
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    //add product
    app.post("/products", verifyJWT,verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });
    //products of a seller
    app.get("/products/:email",verifyJWT,verifySeller, async (req, res) => {
      const email = req.params.email;
      const query = { seller_email: email };
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });
    //delete a A product
    app.delete("/products/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await productCollection.deleteOne(filter);
      res.send(result);
    });
    //all buyers
    app.get("/buyers",verifyJWT,verifyAdmin, async (req, res) => {
      const query = { role: "buyer" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    //all Sellers
    app.get("/sellers",verifyJWT,verifyAdmin, async (req, res) => {
      const query = { role: "seller" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    //seller info by email
    app.get("/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    //save booked items
    app.post("/booked", verifyJWT,verifyBuyer, async (req, res) => {
      const product = req.body;
      const result = await bookedCollection.insertOne(product);
      res.send(result);
    });
    //booked items by user
    app.get("/booked/:email",verifyJWT,verifyBuyer, async (req, res) => {
      const email = req.params.email;
      const query = { buyer_email: email };
      const result = await bookedCollection.find(query).toArray();
      res.send(result);
    });
    //Delete booked  item
    app.delete("/booked/:id", verifyJWT,verifyBuyer, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookedCollection.deleteOne(query);
      res.send(result);
    });
    //stripe
    // app.post("/create-payment-intent", async (req, res) => {
    //   const booking = req.body;
    //   const price = booking.price;
    //   const amount = price * 100;
    //   const paymentIntent = await stripe.paymentIntents.create({
    //     currency: "usd",
    //     amount: amount,
    //     payment_method_types: ["card"],
    //   });
    //   res.send({
    //     clientSecret: paymentIntent.client_secret,
    //   });
    // });
    // //store payment informations
    // app.post("/payments", async (req, res) => {
    //   const payment = req.body;
    //   console.log(payment);
    //   const result = await paymentsCollections.insertOne(payment);
    //   const id = payment.bookingId;
    //   console.log(payment.transactionId);
    //   const filter = { _id: ObjectId(id) };
    //   const updatedDoc = {
    //     $set: {
    //       paid: true,
    //       transactionId: payment.transactionId,
    //     },
    //   };
    //   const updatedProduct = {
    //     $set: {
    //       sold: true,
    //     },
    //   };
    //   const updatedResult = await bookedCollection.updateOne(
    //     filter,
    //     updatedDoc
    //   );
    //   res.send(result);
    // });
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
