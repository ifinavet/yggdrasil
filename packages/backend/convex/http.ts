import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Better Auth
authComponent.registerRoutes(http, createAuth);

export default http;
