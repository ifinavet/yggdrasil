import { httpRouter } from "convex/server";
import { registerFeedbackEmailRoutes } from "./feedback/delivery/http";
import { registerClerkRoutes } from "./users/clerk/http";

const http = httpRouter();
registerFeedbackEmailRoutes(http);

registerClerkRoutes(http);

export default http;
