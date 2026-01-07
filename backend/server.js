const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", require("./routes/auth"));
app.use("/events", require("./routes/events"));
app.use("/register", require("./routes/register"));
app.use("/payment", require("./routes/payment"));
app.use("/user/events", require("./routes/userEvents"));

app.listen(5000,()=>console.log("Server running on port 5000"));
