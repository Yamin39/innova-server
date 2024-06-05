const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(
  cors({
    origin: ["http://localhost:5173", "https://innova-yamin39.web.app", "https://innova-yamin39.firebaseapp.com"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// custom middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log("token inside verify middleware", token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "Unauthorized" });
    }
    // decoded
    console.log("value of decoded", decoded);
    req.user = decoded;
    next();
  });
};

// const uri = "mongodb://localhost:27017";

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6fu63x8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const roomsCollection = client.db("innovaDB").collection("rooms");
    const bookingsCollection = client.db("innovaDB").collection("bookings");
    const reviewsCollection = client.db("innovaDB").collection("reviews");

    // authentication
    const cookieOption = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? true : false,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    };

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "10h" });
      res.cookie("token", token, cookieOption).send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      res.clearCookie("token", { ...cookieOption, maxAge: 0 }).send({ success: true });
    });

    // rooms
    app.get("/rooms", async (req, res) => {
      const cursor = roomsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // filter by price range
    app.get("/filter", async (req, res) => {
      const gte = parseInt(req.query.gte);
      const lte = parseInt(req.query.lte);
      const query = {
        price_per_night: { $gte: gte, $lte: lte },
      };
      const cursor = roomsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // room details
    app.get("/room-details/:id", async (req, res) => {
      const id = req.params.id;
      const result = await roomsCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // bookings
    app.post("/bookings", async (req, res) => {
      const result = await bookingsCollection.insertOne(req.body);
      res.send(result);
    });

    // update availability of a room
    app.patch("/rooms/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updatedDoc = {
        $set: {
          availability: req.body.availability,
        },
      };
      const result = await roomsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // bookings for specific user
    app.get("/bookings", verifyToken, async (req, res) => {
      console.log("token", req.cookies.token);
      const email = req?.query?.email;
      const query = { email: email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // update date of a room
    app.patch("/bookings/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updatedDoc = {
        $set: {
          date: req.body.date,
        },
      };
      const result = await bookingsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // delete booking
    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    // add review
    app.patch("/add-review/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updatedDoc = {
        $push: {
          reviews: req.body,
        },
      };
      const result = await roomsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // add review to its collection
    app.post("/review", async (req, res) => {
      const result = await reviewsCollection.insertOne(req.body);
      res.send(result);
    });

    // reviews for testimonials
    app.get("/review", async (req, res) => {
      const result = await reviewsCollection.find({}, { sort: { timestamp: -1 } }).toArray();
      res.send(result);
    });

    // update review status of a booking
    app.patch("/booking/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updatedDoc = {
        $set: {
          reviewGiven: req.body.reviewGiven,
        },
      };
      const result = await bookingsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Innova Server is running");
});

app.listen(port, () => {
  console.log(`Innova Server is running on port: `, port);
});
