'use strict';

const express = require('express');
const Multer = require('multer');
const {Storage} = require('@google-cloud/storage');
const path = require('path');
const bodyParser = require('body-parser');
const firebase = require("firebase");

// Add the Firebase products
require("firebase/firestore");

const {Firestore} = require('@google-cloud/firestore');

// Load environment variables
const dotenv = require('dotenv');
dotenv.config();

// Instantiate a storage client
const googleCloudStorage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GCLOUD_KEY_FILE
});

// Create a new firestore client
const firestore = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    keyFilename: process.env.GCLOUD_KEY_FILE
});

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

  var collection; 
  var document; 
  
  async function writeToFirestore() {

    // Obtain a document reference.
    collection = firestore.collection('userdata');
    document = collection.doc();

    // Enter new data into the document.
    await document.set({
      source_language: req.body.srclang,
      target_language: req.body.tgtlang,
      bucket_name: `${bucket.name}`,
      file_name: req.file.originalname,
      public_url: `${publicUrl}`
    });

  }

  writeToFirestore().catch(console.error);

  var response = {
    source_language:req.body.srclang,
    target_language:req.body.tgtlang,
    bucket_name:`${bucket.name}`,
    file_name:req.file.originalname,
    public_url:`${publicUrl}`,
    document_id: `${document.id}`
  };
  console.log("Source Language: " + response.source_language); 
  console.log("Target Language: " + response.target_language);
  console.log("Bucket Name: " + response.bucket_name); 
  console.log("File Name: " + response.file_name);
  console.log("Public Url: " + response.public_url); 
  console.log('Document Id:', response.document_id);

  response = {
    source_language:req.body.srclang,
    target_language:req.body.tgtlang,
    message:`Success! File uploaded to ${publicUrl} and database updated with ${document.id}`
  };
  res.end(JSON.stringify(response));

});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});

module.exports = app;