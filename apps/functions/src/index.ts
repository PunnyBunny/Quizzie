import * as functions from "firebase-functions/v2";
import express from "express";
import { router } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { authHandler } from "./middleware/auth";

const app = express();

app.use(express.json());
app.use(authHandler);
app.use(router);
app.use(notFoundHandler);
app.use(errorHandler);

export const api = functions.https.onRequest({ cors: true }, app); // TODO: switch to another service account
