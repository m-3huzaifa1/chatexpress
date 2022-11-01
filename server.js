import express from "express";
import dotenv from "dotenv";
dotenv.config();
import helmet from "helmet";
import xss from "xss-clean";
import mongoSanitize from "express-mongo-sanitize";
import logger from 'morgan';
import "express-async-errors";
import { createServer } from "http";
//socket
import { Server } from "socket.io";
//connect DB
import connectDB from "./db/connect.js";
//cors
import cors from "cors";
//middleware
import notFoundMiddleware from "./middleware/not-found.js";
import errorHandlerMiddleware from "./middleware/error-handler.js";
import authenticateUser from "./middleware/auth.js";
//routes
import authRoute from "./routes/auth.js";
import chatRoute from "./routes/chat.js";
import messageRoute from "./routes/message.js";

const app = express();
const server = createServer(app);

app.get("/", (req, res) => {
  res.send("Server Running!");
});

app.use(cors());
app.use(logger('dev'));
app.use(express.json({limit : '25mb'}));
app.use(helmet());
app.use(xss());
app.use(mongoSanitize());

app.use("/api/v1/auth", authRoute);
app.use("/api/v1/chat", authenticateUser, chatRoute);
app.use("/api/v1/message", authenticateUser, messageRoute);


const port = process.env.PORT || 5000;
const MONGO_URL="mongodb+srv://m3huzaifa1:Huzaifa123@m3huzaifa1.uwkb6rb.mongodb.net/ZetaExpess";

const start = async () => {
  try {
    await connectDB(MONGO_URL);
    server.listen(port, () =>
      console.log(`Server Running on port : ${port}...`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

if (process.env.NODE_ENV === 'production')
{
  app.use('/',express.static('client/build'))
  app.get("*",(req,res)=>{
  res.sendFile(path.resolve(__dirname, 'client/build/index.html'))
  });
}

const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: "*"
  }
});

io.on("connection", (socket) => {
  //connected to correct id
  socket.on("setup", (userData) => {
    socket.join(userData._id);

    socket.emit("connected");
  });

  socket.on("join-chat", (room) => {
    socket.join(room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop-typing", (room) => socket.in(room).emit("stop-typing"));

  socket.on("new-message", (newMessageReceived) => {
    let chat = newMessageReceived.chat;

    if (!chat.users) return console.log(`chat.users not defined`);

    chat.users.forEach((user) => {
      if (user._id === newMessageReceived.sender._id) return;

      socket.in(user._id).emit("message-received", newMessageReceived);
    });
  });

  socket.off("setup", () => {
    socket.leave(userData._id);
  });
});
