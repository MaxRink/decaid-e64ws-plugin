import socket, ssl, threading, sys
LISTEN=("127.0.0.1", int(sys.argv[1]) if len(sys.argv)>1 else 19997)
TARGET=("127.0.0.1", int(sys.argv[2]) if len(sys.argv)>2 else 29997)
ctx=ssl._create_unverified_context()
def pipe(a,b):
    try:
        while True:
            d=a.recv(65536)
            if not d: break
            b.sendall(d)
    except Exception:
        pass
    try: b.shutdown(socket.SHUT_WR)
    except Exception: pass
def handle(c):
    try:
        t=ctx.wrap_socket(socket.create_connection(TARGET,5), server_hostname="127.0.0.1")
    except Exception as e:
        print("connect",e,flush=True); c.close(); return
    threading.Thread(target=pipe,args=(c,t),daemon=True).start()
    threading.Thread(target=pipe,args=(t,c),daemon=True).start()
ls=socket.socket(); ls.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1); ls.bind(LISTEN); ls.listen(16)
print("ready",LISTEN,flush=True)
while True:
    c,_=ls.accept(); threading.Thread(target=handle,args=(c,),daemon=True).start()
