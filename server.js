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

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("test", ({ boardCode }) => {
    socket.emit("joined_board", boards[boardCode]);
  });

  socket.on("create_board", ({ displayName, boardName, sections }) => {
    const boardCode = generateUniqueCode();
    boards[boardCode] = {
      creator: displayName,
      boardName: boardName,
      sections: sections,
      users: [{ id: socket.id, name: displayName, role: "creator" }],
    };
    socket.join(boardCode);

    io.to(socket.id).emit("board_created", {
      boardCode,
      sections: boards[boardCode].sections,
    });

    console.log(`Board created: ${boardCode}, with sections: ${sections}`);
  });

  socket.on("join_board", ({ boardCode, displayName }) => {
    if (boards[boardCode]) {
      socket.join(boardCode);
      boards[boardCode].users.push({
        id: socket.id,
        name: displayName,
        role: "member",
      });
      io.to(boardCode).emit("user_joined", { name: displayName });
      socket.emit("joined_board", { data: boards[boardCode] });
      console.log(`User ${displayName} joined board: ${boardCode}`);
    } else {
      socket.emit("error", { message: "Board not found." });
    }
  });

  socket.on("add_post", ({ boardCode, sectionId, post }) => {
    console.log("added", boardCode, sectionId, post);
    if (boards[boardCode]) {
      const section = boards[boardCode].sections.find(
        (sec) => sec.id === sectionId,
      );
      if (section) {
        section.posts.push(post);
        io.to(boardCode).emit("post_added", { sectionId, post });
      }
    }
    console.log("sections 1", boards[boardCode].sections[1]);
  });

  socket.on("remove_post", ({ boardCode, sectionId, postId }) => {
    if (boards[boardCode]) {
      const section = boards[boardCode].sections.find(
        (sec) => sec.id === sectionId,
      );
      if (section) {
        section.posts = section.posts.filter((post) => post.id !== postId);
        io.to(boardCode).emit("post_removed", { sectionId, postId });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`User Disconnected: ${socket.id}`);
  });
});

function generateUniqueCode() {
  return Math.random().toString(36).substr(2, 5);
}

server.listen(8080, () => {
  console.log("Server Started on port 8080");
});
