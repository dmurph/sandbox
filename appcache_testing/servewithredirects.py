import time
import BaseHTTPServer
import SimpleHTTPServer

HOST_NAME = 'localhost'
PORT_NUMBER = 8000

class MyHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
    def do_HEAD(self):
        print 'in HEAD, path is ' + self.path
        if "/index.html" in self.path and not "redirected" in self.path:
            self.send_response(301)
            self.send_header("Location", 'index2.html')
            self.end_headers()
            return
        if "/index2.html" in self.path:
            self.send_response(301)
            self.send_header("Location", 'index.html')
            self.send_header("Set-Cookie", 'redirected=true')
            self.end_headers()
            return
        SimpleHTTPServer.SimpleHTTPRequestHandler.do_HEAD(self)
    def do_GET(self):
        cookies = None
        if "Cookie" in self.headers:
            cookies = self.headers["Cookie"]
        print 'in GET, path is ' + self.path
        if "/index.html" in self.path and not cookies:
            print 'is index, doing HEAD'
            self.do_HEAD()
            return
        if "/index2.html" in self.path:
            print 'is index2, doing HEAD'
            self.do_HEAD()
            return
        SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)

if __name__ == '__main__':
    server_class = BaseHTTPServer.HTTPServer
    httpd = server_class((HOST_NAME, PORT_NUMBER), MyHandler)
    print time.asctime(), "Server Starts - %s:%s" % (HOST_NAME, PORT_NUMBER)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print time.asctime(), "Server Stops - %s:%s" % (HOST_NAME, PORT_NUMBER)