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
    const res = await nativeFetch(req, init);
    const headers = req instanceof Request ? Object.fromEntries((req).headers.entries()) : init?.headers;
    if(headers && headers['payment-signature']) {
        console.log('PAYMENT REQ 2:', res.headers.get('payment-required'));
    }
    return res;
};

const fetchWithX402 = wrapFetchWithPaymentFromConfig(logFetch, {
  schemes: [
    { network: "eip155:*", client: new ExactEvmScheme(account) }
  ],
});

try {
  let res = await fetchWithX402('https://api.buildwithlocus.com/v1/auth/x402-sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
} catch(e) {}
