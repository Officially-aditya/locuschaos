import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.LOCUS_PRIVATE_KEY;

if (!privateKey) {
  throw new Error("LOCUS_PRIVATE_KEY must be set");
}

const account = privateKeyToAccount(privateKey);

const nativeFetch = globalThis.fetch;
const logFetch = async (req, init) => {
    const headers = req instanceof Request ? Object.fromEntries(req.headers.entries()) : init?.headers;
    const res = await nativeFetch(req, init);
    const pr = res.headers.get('payment-required');
    if (headers && headers['payment-signature'] && pr) {
      console.log('RETRY ERROR:', Buffer.from(pr, 'base64').toString());
    }
    return res;
};

const fetchWithX402 = wrapFetchWithPaymentFromConfig(logFetch, {
  schemes: [
    { network: "eip155:8453", client: new ExactEvmScheme(account) } // FORCE BASE
  ],
  paymentRequirementsSelector: (version, accepts) => accepts.find(x => x.network === 'eip155:8453') // force base in the selector
});

try {
  let res = await fetchWithX402('https://api.buildwithlocus.com/v1/auth/x402-sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  console.log("FINAL STATUS:", res.status);
  console.log("BODY:", await res.json().catch(() => '{}'));
} catch(e) {}
