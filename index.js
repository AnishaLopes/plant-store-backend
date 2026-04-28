import mongoose from "mongoose";
import express, { urlencoded } from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import multer from "multer";
import crypto from "crypto";
import Razorpay from "razorpay";

const app = express();
app.use(express.json());
app.use(cors());
app.use(urlencoded());
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 7000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("Mongo Error:", err));

app.use(cors({
  origin: "*"
}));

const reqSchema = new mongoose.Schema({
  address: String,
  buyerRemarks: String,
  country: String,
  date: String,
  plantName: String,
  plantType: String,
  priority: String,
  reqNo: String,
  userEmail: String,
});

const requestCollection = new mongoose.model("purchaseReq", reqSchema);

const signupSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  resetToken: String,
  resetTokenExpiry: Date,
});

const signupCollection = new mongoose.model("users", signupSchema);

app.post("/createRequest", (req, res) => {
  console.log(req.body);
  requestCollection
    .findOne({ reqNo: req.body.reqNo })
    .then((isReqExists) => {
      if (isReqExists) {
        res.send("Please use a different PR No");
      } else {
        const newPurchaseReq = requestCollection(req.body);
        newPurchaseReq
          .save()
          .then((isSaved) => {
            if (isSaved) {
              res.send("Purchase Request created successfully!");
            } else {
              res.send("Error in creating Purchase Request");
            }
          })
          .catch((exeerror) => {
            console.log(exeerror);
          });
      }
    })
    .catch(() => {});
});

app.get("/get-my-order", async (req, res) => {
  const email = req.query.email;
  const myOrders = await requestCollection.find({ userEmail: email });
  res.send(myOrders);
});

app.post("/signup", (req, res) => {
  console.log(req.body);
  signupCollection
    .findOne({ email: req.body.email })
    .then((isPresent) => {
      if (isPresent) {
        res.send("Email Address Already in use! please try different one.");
      } else {
        const newAccount = signupCollection(req.body);
        newAccount.save().then((issaved) => {
          if (issaved) {
            res.send("Account created successfully");
          } else {
            res.send("error in creating an account");
          }
        });
      }
    })
    .catch();
});

app.post("/login", (req, res) => {
  console.log("req", req.body);
  signupCollection
    .findOne({ email: req.body.email })
    .then((isAuthorized) => {
      if (isAuthorized) {
        console.log(isAuthorized);
        res.send(isAuthorized);
      } else {
        res.send("unauthorized");
      }
    })
    .catch((exe) => {
      res.send("Something went wrong!.please try again");
    });
});

app.listen(PORT, () => {
  console.log("Server running");
});

app.use(
  cors({
    origin: "*",
  }),
);

app.post("/send-mail", upload.single("file"), async (req, res) => {
  const data = req.body;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "anishalopes05@gmail.com",
      pass: "uezlpuangpgnftvj",
    },
  });

  const mailOptions = {
    from: "anishalopes05@gmail.com",
    to: "anishalopes05@gmail.com",
    replyTo: req.body.email,
    subject: "New Requirement Form Submission",
    text: `
    Name: ${req.body.name}
    Plant: ${req.body.plantType}
    Expected Price: ${req.body.price}
    Email: ${req.body.email}
    Message: ${req.body.message}
    `,

    attachments: req.file
      ? [
          {
            filename: req.file.originalname,
            path: req.file.path,
          },
        ]
      : [],
  };

  try {
    await transporter.sendMail(mailOptions);
    res.send("Mail sent successfully!");
  } catch (err) {
    console.log("MAIL ERROR:", err);
    res.send("Error sending mail");
  }
});

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const user = await signupCollection.findOne({ email });

  if (!user) {
    return res.send("User not found");
  }

  const token = crypto.randomBytes(32).toString("hex");

  user.resetToken = token;
  user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 mins

  await user.save();

  const resetLink = `http://localhost:3000/reset-password/${token}`;

  // SEND MAIL
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "anishalopes05@gmail.com",
      pass: "uezlpuangpgnftvj",
    },
  });

  await transporter.sendMail({
    from: "anishalopes05@gmail.com",
    to: email,
    subject: "Password Reset",
    text: `Click to reset password: ${resetLink}`,
  });

  res.send("Reset link sent to your email");
});

app.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const user = await signupCollection.findOne({
    resetToken: token,
    resetTokenExpiry: { $gt: Date.now() },
  });

  if (!user) {
    return res.send("Invalid or expired token");
  }

  user.password = password;
  user.resetToken = null;
  user.resetTokenExpiry = null;

  await user.save();

  res.send("Password reset successful");
});

const razorpay = new Razorpay({
  key_id: "rzp_test_SitV0aQwGbXtBN",
  key_secret: "RgaISEXc7ZfrLikT3J0NxbmA",
});

app.post("/create-order", async (req, res) => {
  const { amount } = req.body;

  const options = {
    amount: amount * 100, // convert ₹ → paise
    currency: "INR",
    receipt: "order_" + Date.now(),
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating order");
  }
});
