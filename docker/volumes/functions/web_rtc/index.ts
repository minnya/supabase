import { serve } from "https://deno.land/std/http/server.ts";
import { acceptable, acceptWebSocket, WebSocket } from "https://deno.land/std/ws/mod.ts";

const port = parseInt(Deno.env.get("PORT") || "5000");

const server = serve({ port });

console.log(`WebSocket server is running on :${port}`);

const sockets = new Map<string, WebSocket>();

for await (const req of server) {
  if (acceptable(req)) {
    acceptWebSocket({
      conn: req.conn,
      bufReader: req.r,
      bufWriter: req.w,
      headers: req.headers,
    }).then(handleWebSocket);
  }
}

function handleWebSocket(socket: WebSocket): void {
  const { searchParams } = new URL(socket.conn.remoteAddr.transport as string);
  const callerId = searchParams.get("callerId");

  if (callerId) {
    sockets.set(callerId, socket);

    console.log(`${callerId} Connected`);

    for await (const ev of socket) {
      if (typeof ev === "string") {
        const data = JSON.parse(ev);

        switch (data.event) {
          case "makeCall":
            const calleeId = data.calleeId;
            const sdpOffer = data.sdpOffer;

            const calleeSocket = sockets.get(calleeId);

            if (calleeSocket) {
              calleeSocket.send(JSON.stringify({
                event: "newCall",
                callerId,
                sdpOffer,
              }));
            }
            break;

          case "answerCall":
            const sdpAnswer = data.sdpAnswer;
            const callerSocket = sockets.get(data.callerId);

            if (callerSocket) {
              callerSocket.send(JSON.stringify({
                event: "callAnswered",
                callee: callerId,
                sdpAnswer,
              }));
            }
            break;

          case "IceCandidate":
            const iceCandidate = data.iceCandidate;
            const targetId = data.calleeId;

            const targetSocket = sockets.get(targetId);

            if (targetSocket) {
              targetSocket.send(JSON.stringify({
                event: "IceCandidate",
                sender: callerId,
                iceCandidate,
              }));
            }
            break;

          case "leaveCall":
            const targetIdForLeave = data.calleeId;
            const targetSocketForLeave = sockets.get(targetIdForLeave);

            if (targetSocketForLeave) {
              targetSocketForLeave.send(JSON.stringify({
                event: "callLeft",
                callerId,
              }));
            }
            break;

          default:
            break;
        }
      }
    }
  }
}
