import socket
import time

HOST = 'localhost'
PORT = 3000  # change to your server's port

def send_raw_request(name, request_lines, body_chunks=None, delay=0.5):
    print(f"\n--- {name} ---")
    with socket.create_connection((HOST, PORT), timeout=10) as sock:
        # Send headers
        sock.sendall(request_lines.encode('utf-8'))

        # Optionally send body chunks slowly
        if body_chunks:
            for chunk in body_chunks:
                sock.sendall(chunk.encode('utf-8'))
                print(f"[sent chunk] {repr(chunk)}")
                time.sleep(delay)

        # Keep socket open a bit to observe server timeout/response
        sock.settimeout(30)
        try:
            response = sock.recv(4096)
            print("[response]")
            print(response.decode(errors='replace'))
        except socket.timeout:
            print("[no response received within timeout]")

# --- Test 1: Mismatched Content-Length (claims 400, sends {}) ---
send_raw_request(
    "Mismatched Content-Length",
    request_lines=(
        "POST /api HTTP/1.1\r\n"
        "Host: localhost\r\n"
        "Content-Type: application/json\r\n"
        "Content-Length: 400\r\n"
        "\r\n"
    ),
    body_chunks=["{}"],
    delay=0  # send immediately
)

# --- Test 2: Empty POST Body (Content-Length 0) ---
send_raw_request(
    "Empty POST Body",
    request_lines=(
        "POST /api HTTP/1.1\r\n"
        "Host: localhost\r\n"
        "Content-Type: application/json\r\n"
        "Content-Length: 0\r\n"
        "\r\n"
    )
)

# --- Test 3: Slow Body Upload (send slowly, with correct length) ---
body = '{"message":"hello"}'
send_raw_request(
    "Slow Body Upload",
    request_lines=(
        f"POST /api HTTP/1.1\r\n"
        f"Host: localhost\r\n"
        f"Content-Type: application/json\r\n"
        f"Content-Length: {len(body)}\r\n"
        "\r\n"
    ),
    body_chunks=[c for c in body],  # send one character at a time
    delay=0.4
)


# --- Test 4: Send the entirety of the request very slowly ---
send_raw_request(
    "Slow overall drip",
    request_lines=(""),
    body_chunks=[
        f"POST /api HTTP/1.1\r\n",
        f"Host: localhost\r\n",
        f"Content-Type: application/json\r\n",
        f"Content-Length: 400\r\n",
        "\r\n",
    ],
    delay=3.5  
)
