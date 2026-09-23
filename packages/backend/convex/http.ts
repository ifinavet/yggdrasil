import { httpRouter } from "convex/server";
import { registerClerkRoutes } from "./users/clerk/http";

const http = httpRouter();

registerClerkRoutes(http);

export default http;
