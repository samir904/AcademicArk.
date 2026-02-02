import axios from "axios";

const CASHFREE_BASE_URL =
  process.env.CASHFREE_ENV === "PRODUCTION"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

const cashfreeClient = axios.create({
  baseURL: CASHFREE_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "x-api-version": "2025-01-01",
    "x-client-id": process.env.CASHFREE_CLIENT_ID,
    "x-client-secret": process.env.CASHFREE_CLIENT_SECRET
  }
});

export default cashfreeClient;
