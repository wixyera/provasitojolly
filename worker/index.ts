import handler from "vinext/server/fetch-handler";
import { processEmails } from "./email-jobs";
export default {
 ...handler,
 async scheduled(){ await processEmails(); }
};
