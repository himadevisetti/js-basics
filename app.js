'use strict';

const express = require('express');
const Multer = require('multer');
const {Storage} = require('@google-cloud/storage');
const {PubSub} = require('@google-cloud/pubsub');
const path = require('path');
const bodyParser = require('body-parser');

// Load environment variables
const dotenv = require('dotenv');
dotenv.config();

// Instantiate a storage client
const googleCloudStorage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GCLOUD_KEY_FILE
});

// Creates a client; cache this for further use
const pubSubClient = new PubSub();

// PubSub topic details
const topicName = process.env.GOOGLE_PUBSUB_TOPIC;

// Instantiate an express server
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));

// Multer is required to process file uploads and make them available via
// req.files.
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // no larger than 5mb, you can change as needed
  }
});

// A bucket is a container for objects (files).
const bucket = googleCloudStorage.bucket(process.env.GCLOUD_STORAGE_BUCKET);

// Display a form for uploading files.
app.get("/", (req, res) => {
  res.sendFile(path.join(`${__dirname}/index.html`));
});

// Process the file upload and upload to Google Cloud Storage.
app.post("/upload", multer.single("file"), (req, res, next) => {
  // Create a new blob in the bucket and upload the file data.
  const blob = bucket.file(req.file.originalname);

  // The public URL can be used to directly access the file via HTTP.
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`; 
  
  if (!req.file) {
    res.status(400).send("No file uploaded.");
    return;
  }

  // Make sure to set the contentType metadata for the browser to be able
  // to render the file instead of downloading the file (default behavior)
  const blobStream = blob.createWriteStream({
    metadata: {
      contentType: req.file.mimetype
    }
  });

  blobStream.on("error", err => {
    next(err);
    return;
  });

  blobStream.on("finish", () => {
    // The public URL can be used to directly access the file via HTTP.
    // const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
    blob.makePublic(); 
  });

  blobStream.end(req.file.buffer);
  var response = {
    source_language:req.body.srclang,
    target_language:req.body.tgtlang,
    file_name:req.file.originalname,
    public_url:`${publicUrl}`
  };
  console.log("Source Language: " + response.source_language); 
  console.log("Target Language: " + response.target_language);
  console.log("File Name: " + response.file_name);
  console.log("Public Url: " + response.public_url); 

  const publish_data = JSON.stringify(response); 
  
  async function publishMessage() {
    // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
    const dataBuffer = Buffer.from(publish_data);
    const messageId = await pubSubClient.topic(topicName).publish(dataBuffer);
    console.log(`Message ${messageId} published.`); 
  }

  publishMessage().catch(console.error);
  // [END pubsub_publish]

  response = {
    source_language:req.body.srclang,
    target_language:req.body.tgtlang,
    message:`Success! File uploaded to ${publicUrl} and message published`
  };
  res.end(JSON.stringify(response));

});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});

module.exports = app;