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

const user = {};

function generateUniqueCode() {
  return Math.random().toString(36).substr(2, 5);
}

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  let currentBoardCode = null;

  socket.on("test", ({ boardCode }) => {
    socket.emit("joined_board", boards[boardCode]);
  });

  socket.on("create_board", ({ displayName, bgColor, boardName, sections }) => {
    const boardCode = generateUniqueCode();

    user.id = socket.id;
    user.name = displayName;
    user.role = "creator";
    user.color = bgColor;

    boards[boardCode] = {
      creator: displayName,
      boardCode,
      boardName,
      sections,
      users: [user],
    };

    socket.join(boardCode);
    currentBoardCode = boardCode;

    io.to(socket.id).emit("board_created", {
      board: boards[boardCode],
      user: user,
    });

    console.log(`Board created: ${boardCode}, with sections: ${sections}`);
  });

  socket.on("join_board", ({ boardCode, displayName, bgColor }) => {
    const board = boards[boardCode];

    user.id = socket.id;
    user.name = displayName;
    user.role = "member";
    user.color = bgColor;

    if (board) {
      socket.join(boardCode);
      currentBoardCode = boardCode;

      board.users.push(user);

      io.to(boardCode).emit("user_joined", { name: displayName });
      socket.emit("joined_board", { board: boards[boardCode], user: user });

      console.log(`User ${user.name} joined board: ${boardCode}`);
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

  socket.on("start_voting", () => {
    io.to(currentBoardCode).emit("vote_started");
    console.log(`voting start on ${currentBoardCode}`);
  });

  socket.on("upvote_post", ({ postId, sectionId }) => {
    const board = boards[currentBoardCode];

    if (board) {
      const section = board.sections.find((sec) => sec.id === sectionId);
      if (section) {
        const post = section.posts.find((post) => post.id === postId);
        if (post) {
          post.likeCount += 1;
          io.to(currentBoardCode).emit("post_voted_update", {
            sectionId: sectionId,
            postId: postId,
            likeCount: post.likeCount,
          });

          console.log(
            `Post with ID ${postId} in section ${sectionId} has been upvoted. New like count: ${post.likeCount}`,
          );
        }
      }
    }
  });

  socket.on("undo_upvote_post", ({ postId, sectionId }) => {
    const board = boards[currentBoardCode];

    if (board) {
      const section = board.sections.find((sec) => sec.id === sectionId);
      if (section) {
        const post = section.posts.find((post) => post.id === postId);
        if (post) {
          post.likeCount -= 1;
          io.to(currentBoardCode).emit("post_voted_update", {
            sectionId: sectionId,
            postId: postId,
            likeCount: post.likeCount,
          });

          console.log(
            `Post with ID ${postId} in section ${sectionId} has been upvoted. New like count: ${post.likeCount}`,
          );
        }
      }
    }
  });

  socket.on("post_comment", ({ postId, sectionId, comment }) => {
    console.log("this is a log", postId, sectionId, comment);
    const board = boards[currentBoardCode];

    if (board) {
      const section = board.sections.find((sec) => sec.id === sectionId);
      if (section) {
        const post = section.posts.find((post) => post.id === postId);
        if (post) {
          post.comments.push(comment);
          io.to(currentBoardCode).emit("post_comments_update", {
            sectionId: sectionId,
            postId: postId,
            comment: comment,
          });

          console.log(
            `Added comment to ${postId}. Now has ${post.comments.length} comments`,
          );
        }
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`User Disconnected: ${socket.id}`);

    const rooms = Object.keys(socket.rooms);
    rooms.forEach((room) => {
      if (boards[room]) {
        const board = boards[room];
        board.users = board.users.filter((user) => user.id !== socket.id);

        socket.to(room).emit("left_board", { userId: socket.id });
      }
    });
  });
});

server.listen(8080, () => {
  console.log("Server Started on port 8080");
});
