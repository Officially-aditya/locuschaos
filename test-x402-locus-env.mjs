import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.LOCUS_PRIVATE_KEY;

if (!privateKey) {
  throw new Error("LOCUS_PRIVATE_KEY must be set");
}

const account = privateKeyToAccount(privateKey);
const fetchWithX402 = wrapFetchWithPaymentFromConfig(globalThis.fetch, {
  schemes: [ { network: "eip155:*", client: new ExactEvmScheme(account) } ],
});

const res = await fetchWithX402('https://api.buildwithlocus.com/v1/auth/x402-sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
});
console.log("FINAL STATUS:", res.status);
const text = await res.text();
console.log("BODY:", text);
