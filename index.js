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
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.o9ekdiy.mongodb.net/?retryWrites=true&w=majority`
console.log(uri);
// const uri = process.env.DB_URI;
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
    const promotionCollection = client.db("pre-owned").collection("promoted-items");
    const paymentsCollections = client.db("pre-owned").collection("payments");
    // Verify admin
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
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
      const query = {
        category: name,
        // sold: false,
      };
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });
    //get products
    app.get("/all-products", async (req, res) => {
      const query = { sold: false };
      // console.log(result);
      const result = await productCollection
        .find(query)
        .sort({ published_date: -1 })
        .toArray();
      res.send(result);
    });
    //get products admin
    app.get("/all-products-admin",verifyJWT,verifyAdmin, async (req, res) => {
      const result = await productCollection
        .find({})
        .sort({ published_date: -1 })
        .toArray();
      console.log(result);
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
    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });
    //products of a seller
    app.get("/products/:email", verifyJWT, verifySeller, async (req, res) => {
      const email = req.params.email;
      const query = { seller_email: email };
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });
    //advertisement
    app.put("/products/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          advertisement: true,
        },
      };
      const result = await productCollection.updateOne(
        filter,
        updateDoc,
        options
      );

      //save to collection
      // const promotedItems = await productCollection
      //   .find({
      //     advertisement: true,
      //   })
      //   .toArray();
      // console.log(promotedItems);
      // const addToCollection = await promotionCollection.insertMany(
      //   promotedItems
      // );

      res.send(result);
    });
    // api for advertisement products
    app.get("/advertisement", async (req, res) => {
      const filter = { advertisement: true };
      const result = await productCollection
        .find(filter)
        .sort({ published_date: -1 })
        .toArray();
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
    app.get("/buyers", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { role: "buyer" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    //all Sellers
    app.get("/sellers", verifyJWT, verifyAdmin, async (req, res) => {
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

    //Reported  items
    app.put("/reported", verifyJWT, verifyBuyer, async (req, res) => {
      const product = req.body;
      const result = await productCollection.updateOne(
        { _id: ObjectId(product._id) },
        { $set: { reported: true } }
        // {upsert: true}
      );
      console.log(result);
      res.send(result);
    });
    //Get Reported Items
    app.get("/reported", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { reported: true };
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });
    //delete reported Items
    app.delete("/reported/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await productCollection.deleteOne(filter);
      res.send(result);
    });
    //save booked items
    app.post("/booked", verifyJWT, verifyBuyer, async (req, res) => {
      const product = req.body;
      const result = await bookedCollection.insertOne(product);
      const updatedproductCollection = await productCollection.updateOne(
        { _id: ObjectId(product.product_id) },
        { $set: { booked: true } },
        { upsert: true }
      );
      res.send(result);
    });
    //booked items by user
    app.get("/booked/:email", async (req, res) => {
      const email = req.params.email;
      const query = { buyer_email: email };
      const result = await bookedCollection.find(query).toArray();
      res.send(result);
    });
    //booked items by user
    app.get("/booked-item/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: ObjectId(id) };
      const result = await bookedCollection.findOne(query);
      res.send(result);
    });
    //Delete booked  item
    app.delete("/booked/:id", verifyJWT, verifyBuyer, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookedCollection.deleteOne(query);
      res.send(result);
    });
    //stripe
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.resell_Price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      // console.log(paymentIntent);
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    // //store payment informations
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollections.insertOne(payment);
      const id = payment.product_id;
      const filter = { product_id: id };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await paymentsCollections.updateOne(
        filter,
        updatedDoc
      );
      // console.log(updatedResult);
      const updatedPaid = {
        $set: {
          paid: true,
        },
      };
      // console.log(payment);
      const updatedBookedCollection = await bookedCollection.updateOne(
        filter,
        updatedPaid
        // {upsert: true}
      );
      const updatedproductCollection = await productCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: { sold: true } }
        // {upsert: true}
      );
      console.log(updatedproductCollection);
      res.send(updatedResult);
    });
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
