
# HTTP Header Oversize (HHO) Cache Poisoning Lab

A demonstration of cache poisoning via HTTP Header Oversize (HHO) attacks.

## Vulnerability Description
The swap estimation endpoint (`/api/swap-estimate`) is vulnerable to HTTP Header Oversize (HHO) attacks due to:
1. Using headers in cache key generation
2. Lack of header size validation
3. Vulnerable caching implementation

## Key Vulnerability Details
- **Attack Type**: Cache Poisoning via Header Oversize
- **Risk**: High
- **Endpoint**: `/api/swap-estimate`
- **Trigger**: Requests with headers exceeding 16KB total size
- **Impact**: Persistent malicious cache entries affecting all users

## Exploitation Scenario
1. Attacker sends request with oversized headers containing:
   - Malicious payload in header values
   - Normal-looking request parameters
2. Server:
   - Fails to validate header sizes
   - Generates cache key using headers
   - Stores poisoned response
3. Subsequent users receive malicious cached response

## How to Test the HHO Attack

1. Start the server with increased header limits:
```bash
node --max-http-header-size=17000 server.js
```

2. Send poisoning request:
```bash
curl "http://localhost:4000/api/swap-estimate?fromToken=ETH&toToken=USDC&amount=1" \
  -H "X-Large-Header-1: $(head -c 8000 < /dev/zero | tr '\0' 'a')" \
  -H "X-Large-Header-2: $(head -c 8000 < /dev/zero | tr '\0' 'b')"
```

3. Verify cached response persists through normal requests:
```bash
curl http://localhost:4000/api/swap-estimate?fromToken=ETH&toToken=USDC&amount=1
```

## Lab Setup

The lab consists of two components:

1. **Backend Server (server.js)**: An Express API that implements the vulnerable cache mechanisms
2. **Frontend React App**: A simple DeFi interface that displays prices and swap functionality

## Running the Lab

### Prerequisites

- Node.js (v23)
- npm or yarn

### Installation

1. Clone this repository
2. Install dependencies:

```bash
# Install server dependencies
npm install express cors

# Install React app dependencies
cd cache_poisoning_lab
npm install
```

### Starting the Lab

1. **Start the server first**:

```bash
# From the project root directory
node --max-http-header-size=17000 server.js
```

The server will run on http://localhost:4000 and output instructions for testing the vulnerabilities.

2. **Start the React app** (in a new terminal):

```bash
# From the cache_poisoning_lab directory
npm start
```

The React app will run on http://localhost:3000.


## Disclaimer

This lab contains intentional security vulnerabilities for educational purposes. Do not use this code in production environments. 