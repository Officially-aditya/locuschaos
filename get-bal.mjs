import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const publicClient = createPublicClient({
  chain: base,
  transport: http()
})

const balance = await publicClient.readContract({
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  abi: [{
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  }],
  functionName: 'balanceOf',
  args: ['0x0dE96cc253B4cC236C8349cd0B2D9Fd56bc2D578']
})

console.log('Balance:', balance)
