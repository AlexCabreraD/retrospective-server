const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const boards = {};

function generateUniqueCode() {
  return Math.random().toString(36).substr(2, 5);
}

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("test", ({ boardCode }) => {
    socket.emit("joined_board", boards[boardCode]);
  });

  socket.on("create_board", ({ displayName, boardName, sections }) => {
    const boardCode = generateUniqueCode();

    boards[boardCode] = {
      creator: displayName,
      boardCode,
      boardName,
      sections,
      users: [{ id: socket.id, name: displayName, role: "creator" }],
    };

    socket.join(boardCode);

    io.to(socket.id).emit("board_created", { board: boards[boardCode] });

    console.log(`Board created: ${boardCode}, with sections: ${sections}`);
  });

  socket.on("join_board", ({ boardCode, displayName }) => {
    const board = boards[boardCode];

    if (board) {
      socket.join(boardCode);

      board.users.push({ id: socket.id, name: displayName, role: "member" });

      io.to(boardCode).emit("user_joined", { name: displayName });

      socket.emit("joined_board", { board: boards[boardCode] });

      console.log(`User ${displayName} joined board: ${boardCode}`);
    } else {
      socket.emit("error", { message: "Board not found." });
    }
  });

  socket.on("check_room", ({ boardCode }) => {
    const rooms = socket.rooms;
    if (rooms.has(boardCode)) {
      socket.emit("room_status", { inRoom: true });
      console.log(`User ${socket.id} is in room: ${boardCode}`);
    } else {
      socket.emit("room_status", { inRoom: false });
      console.log(`User ${socket.id} is not in room: ${boardCode}`);
    }
  });

  socket.on("check_room_exists", ({ boardCode }) => {
    const room = io.sockets.adapter.rooms.get(boardCode);

    if (room) {
      const usersInRoom = Array.from(room);
      socket.emit("room_exists", { exists: true, users: usersInRoom });
      console.log(`Room ${boardCode} exists with users:`, usersInRoom);
    } else {
      socket.emit("room_exists", { exists: false });
      console.log(`Room ${boardCode} does not exist.`);
    }
  });

  socket.on("add_post", ({ boardCode, sectionId, post }) => {
    const board = boards[boardCode];

    if (board) {
      const section = board.sections.find((sec) => sec.id === sectionId);

      if (section) {
        section.posts.push(post);
        io.to(boardCode).emit("post_added", { sectionId, post });

        console.log(`Post added to board ${boardCode}, section ${sectionId}`);
      }
    }
  });

  socket.on("remove_post", ({ boardCode, sectionId, postId }) => {
    const board = boards[boardCode];

    if (board) {
      const section = board.sections.find((sec) => sec.id === sectionId);

      if (section) {
        section.posts = section.posts.filter((post) => post.id !== postId);
        io.to(boardCode).emit("post_removed", { sectionId, postId });

        console.log(
          `Post removed from board ${boardCode}, section ${sectionId}`,
        );
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`User Disconnected: ${socket.id}`);
  });
});

server.listen(8080, () => {
  console.log("Server Started on port 8080");
});
