import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.LOCUS_PRIVATE_KEY;
const locusApiKey = process.env.LOCUS_API_KEY;

if (!privateKey || !locusApiKey) {
  throw new Error("LOCUS_PRIVATE_KEY and LOCUS_API_KEY must be set");
}

const account = privateKeyToAccount(privateKey);
const fetchWithX402 = wrapFetchWithPaymentFromConfig(globalThis.fetch, {
  schemes: [
    { network: "eip155:137", client: new ExactEvmScheme(account) },
    { network: "eip155:8453", client: new ExactEvmScheme(account) }
  ],
});

try {
  const tokenRes = await globalThis.fetch('https://beta-api.buildwithlocus.com/v1/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: locusApiKey })
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.token;

  let res = await fetchWithX402('https://beta-api.buildwithlocus.com/v1/billing/x402-top-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ amount: 5.00 })
  });
  console.log("STATUS:", res.status);
  console.log("BODY:", await res.text());
} catch(e) { console.error(e) }
