# Chat — Event / API reference

Transport: **SignalR** hub `/hubs/chat` + REST.
REST needs `Authorization: Bearer <accessToken>` except `/api/auth/*`.
Base URL: `http://localhost:5143`

---

## API — POST /api/auth/login

Payload
```json
{
  "email": "chat.michael@yopmail.com",
  "password": "Test@1234",
  "deviceId": "web-1",
  "platform": "Web"
}
```

Response
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "userId": 142,
    "firstName": "Michael",
    "lastName": "Anderson",
    "email": "chat.michael@yopmail.com",
    "role": "User",
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "9f2c1a4e...",
    "accessTokenExpiry": "2026-08-17T14:55:00Z",
    "refreshTokenExpiry": "2026-09-16T13:55:00Z"
  }
}
```

---

## API — GET /api/dating/matches

Payload
```json
{}
```

Response
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": 15,
      "otherUserId": 143,
      "otherFirstName": "Jessica",
      "otherLastName": "Miller",
      "otherPseudoName": "jess_m",
      "otherProfileImageUrl": null,
      "otherDisplayImageUrl": null,
      "otherAge": 29,
      "matchedAt": "2026-08-13T09:12:44.000Z",
      "unreadCount": 2,
      "lastMessage": "3 photos",
      "lastMessageAt": "2026-08-17T12:55:56.601Z"
    }
  ]
}
```

---

## API — GET /api/dating/matches/{matchId}/messages

Payload — path + query, no body
```json
{
  "matchId": 15,
  "page": 1,
  "pageSize": 50
}
```

Response — newest first, reverse for display
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": 47,
      "matchId": 15,
      "senderId": 142,
      "receiverId": 143,
      "content": "Three shots in one message.",
      "messageType": "Image",
      "fileUrl": "/chat/15/df917ccd.png",
      "attachments": [
        {
          "id": 6,
          "fileUrl": "/chat/15/df917ccd.png",
          "fileType": "Image",
          "fileName": "shot-A.png",
          "fileSizeBytes": 1245,
          "sortOrder": 0
        },
        {
          "id": 7,
          "fileUrl": "/chat/15/b4922568.png",
          "fileType": "Image",
          "fileName": "shot-B.png",
          "fileSizeBytes": 1106,
          "sortOrder": 1
        }
      ],
      "sentAt": "2026-08-17T12:55:56.601",
      "isRead": true
    }
  ],
  "totalRecords": 47,
  "page": 1,
  "pageSize": 50,
  "totalPages": 1
}
```

---

## API — PATCH /api/dating/matches/{matchId}/messages/read

Payload — path only, no body
```json
{
  "matchId": 15
}
```

Response
```json
{
  "success": true,
  "message": "Messages marked as read."
}
```

---

## API — POST /api/dating/matches/{matchId}/upload

Single file. `multipart/form-data`, key `file`. Legacy — pair with `SendChatFile`.

Payload
```json
{
  "matchId": 15,
  "file": "shot-A.png"
}
```

Response
```json
{
  "success": true,
  "message": "File uploaded. Use the URL in SendChatFile via SignalR.",
  "data": "/chat/15/716a4904.png"
}
```

---

## API — POST /api/dating/matches/{matchId}/uploads

Many files. `multipart/form-data`, key `files` repeated. Max 10.
Accepts `image/*`, `video/*`, `audio/*` — anything else returns 400.

> ⚠️ **Corrected 2026-08-18 (verified against the live beta API).** The
> wildcard claim above is **wrong** — this endpoint enforces a fixed
> allow-list and returns
> `{"success": false, "message": "Attachment type '<mime>' is not allowed."}`
> for anything outside it:
>
> | | Accepted | Rejected (verified) |
> |---|---|---|
> | image | `image/jpeg` `image/png` `image/webp` | `image/jpg` `image/pjpeg` `image/JPEG` `image/heic` `image/heif` `image/gif` |
> | video | `video/mp4` `video/quicktime` | `video/mov` `video/mpeg4` `video/x-m4v` `video/3gpp` `video/webm` |
> | audio | `audio/m4a` `audio/aac` `audio/mpeg` | `audio/x-m4a` `audio/mp3` `audio/mp4` `audio/wav` `audio/ogg` `audio/3gpp` `audio/amr` `audio/x-caf` |
>
> The match is **exact and case-sensitive** — `image/JPEG` is refused. Three
> rejections bite in practice; all are tracked as gap #18 in
> [API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md):
> - **`image/jpg`** is what `react-native-image-picker` reports for every JPEG
>   (it concatenates a sniffed extension onto `"image/"`), so the most ordinary
>   attachment there is carries a MIME the API refuses. Canonicalised in
>   `src/services/chatAttachments.ts`.
> - **`audio/x-m4a`** is the MIME iOS derives for a `.m4a` recording, so every
>   voice note sent from an iPhone was rejected. Worked around client-side in
>   `src/utils/uploadPart.ts`.
> - **`image/heic`** is the default iPhone photo format. The app dodges this
>   because `react-native-image-picker` re-encodes to JPEG when `quality` is
>   set, but any client that uploads the original file will fail.

Payload
```json
{
  "matchId": 15,
  "files": ["shot-A.png", "shot-B.png", "voice.mp3"]
}
```

Response
```json
{
  "success": true,
  "message": "3 file(s) uploaded. Pass these to SendMessageWithAttachments via SignalR.",
  "data": [
    {
      "fileUrl": "/chat/15/df917ccd.png",
      "fileType": "Image",
      "fileName": "shot-A.png",
      "fileSizeBytes": 1245
    },
    {
      "fileUrl": "/chat/15/b4922568.png",
      "fileType": "Image",
      "fileName": "shot-B.png",
      "fileSizeBytes": 1106
    },
    {
      "fileUrl": "/chat/15/49db94d4.mp3",
      "fileType": "VoiceNote",
      "fileName": "voice.mp3",
      "fileSizeBytes": 20480
    }
  ]
}
```

---

## API — DELETE /api/dating/matches/{matchId}

Unmatch. Deletes the match, its messages and their attachments.

Payload
```json
{
  "matchId": 15
}
```

Response
```json
{
  "success": true,
  "message": "Unmatched successfully."
}
```

---

## API — POST /api/auth/register/profile-image

No token. `multipart/form-data`, key `file`. `image/jpeg` | `image/png` | `image/webp`.

Payload
```json
{
  "file": "avatar.png"
}
```

Response
```json
{
  "success": true,
  "message": "Image uploaded. Send this URL as profilePictureUrl when registering.",
  "data": "/profiles/pending/ecc8a77f.png"
}
```

---

# SignalR — client → server (invoke)

## EVENT — SendMessage

Text only.

Payload — argument order
```json
{
  "matchId": 15,
  "receiverId": 143,
  "content": "Hey Jessica.",
  "messageType": "Text"
}
```

Response — arrives as the `ReceiveMessage` event
```json
{
  "id": 51,
  "matchId": 15,
  "senderId": 142,
  "receiverId": 143,
  "content": "Hey Jessica.",
  "messageType": "Text",
  "fileUrl": null,
  "attachments": [],
  "sentAt": "2026-08-17T13:02:18.198Z",
  "isRead": false
}
```

---

## EVENT — SendMessageWithAttachments

Text, files, or both — one message. Max 10 files.

Payload
```json
{
  "matchId": 15,
  "receiverId": 143,
  "content": "Three shots in one message.",
  "attachments": [
    {
      "fileUrl": "/chat/15/df917ccd.png",
      "fileType": "Image",
      "fileName": "shot-A.png",
      "fileSizeBytes": 1245
    },
    {
      "fileUrl": "/chat/15/b4922568.png",
      "fileType": "Image",
      "fileName": "shot-B.png",
      "fileSizeBytes": 1106
    }
  ]
}
```
`content` may be `null` when there is at least one attachment.

Response — arrives as the `ReceiveMessage` event
```json
{
  "id": 47,
  "matchId": 15,
  "senderId": 142,
  "receiverId": 143,
  "content": "Three shots in one message.",
  "messageType": "Image",
  "fileUrl": "/chat/15/df917ccd.png",
  "attachments": [
    {
      "fileUrl": "/chat/15/df917ccd.png",
      "fileType": "Image",
      "fileName": "shot-A.png",
      "fileSizeBytes": 1245,
      "sortOrder": 0
    },
    {
      "fileUrl": "/chat/15/b4922568.png",
      "fileType": "Image",
      "fileName": "shot-B.png",
      "fileSizeBytes": 1106,
      "sortOrder": 1
    }
  ],
  "sentAt": "2026-08-17T12:55:56.601Z",
  "isRead": false
}
```

---

## EVENT — SendChatFile

Legacy, one file.

Payload
```json
{
  "matchId": 15,
  "receiverId": 143,
  "fileUrl": "/chat/15/716a4904.png",
  "messageType": "Image"
}
```

Response — arrives as the `ReceiveMessage` event
```json
{
  "id": 50,
  "matchId": 15,
  "senderId": 142,
  "receiverId": 143,
  "content": null,
  "messageType": "Image",
  "fileUrl": "/chat/15/716a4904.png",
  "attachments": [
    {
      "fileUrl": "/chat/15/716a4904.png",
      "fileType": "Image",
      "fileName": null,
      "fileSizeBytes": null,
      "sortOrder": 0
    }
  ],
  "sentAt": "2026-08-17T13:00:38.966Z",
  "isRead": false
}
```

---

## EVENT — MarkAsRead

`senderId` is the **peer** — the one who gets `MessagesRead`.

Payload
```json
{
  "matchId": 15,
  "senderId": 143
}
```

Response — the peer receives the `MessagesRead` event
```json
{
  "matchId": 15
}
```

---

# SignalR — server → client (listen)

## EVENT — ReceiveMessage

Fired for the receiver **and echoed back to the sender**, so do not append optimistically.

Payload — none, this is inbound
```json
{}
```

Response — the message that was stored
```json
{
  "id": 47,
  "matchId": 15,
  "senderId": 142,
  "receiverId": 143,
  "content": "Three shots in one message.",
  "messageType": "Image",
  "fileUrl": "/chat/15/df917ccd.png",
  "attachments": [
    {
      "fileUrl": "/chat/15/df917ccd.png",
      "fileType": "Image",
      "fileName": "shot-A.png",
      "fileSizeBytes": 1245,
      "sortOrder": 0
    }
  ],
  "sentAt": "2026-08-17T12:55:56.601Z",
  "isRead": false
}
```

---

## EVENT — MessagesRead

Payload
```json
{}
```

Response — single argument, the match id
```json
{
  "matchId": 15
}
```

---

## EVENT — UserOnline

Broadcast to **every** connected user, not only matches.

Payload
```json
{}
```

Response
```json
{
  "userId": 143
}
```

---

## EVENT — UserOffline

Payload
```json
{}
```

Response
```json
{
  "userId": 143
}
```

---

## EVENT — Error

The last invoke was rejected.

Payload
```json
{}
```

Response
```json
{
  "message": "A message may carry at most 10 attachments."
}
```

All possible values
```json
[
  "Match not found.",
  "Receiver is not part of this match.",
  "MessageType must be Image, Video, or VoiceNote.",
  "A message must have text, at least one attachment, or both.",
  "A message may carry at most 10 attachments.",
  "Attachment fileType must be one of: Image, Video, VoiceNote.",
  "Every attachment must have a fileUrl."
]
```

---

# Notes

```json
{
  "messageType": "'Text' when no files, else the FIRST attachment's type",
  "fileUrl": "legacy mirror of the first attachment - new clients read 'attachments'",
  "fileType": ["Image", "Video", "VoiceNote"],
  "maxAttachmentsPerMessage": 10,
  "sentAt": "hub payload ends in Z; REST history has NO zone marker - parse as UTC",
  "signalRClient": "withCredentials must be false (API CORS is AllowAnyOrigin)",
  "connectionsPerUser": "1 - a second login takes over delivery from the first",
  "presenceRoster": "none - UserOnline only fires on connect, joiners miss who is already online"
}
```
