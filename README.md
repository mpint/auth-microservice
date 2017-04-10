# Web authentication microservice
An authentication layer on top of stormpath

### Deployment
1. Export your Stormpath API Key ID / Secret and Application HREF Environment Variables (in config/export-keys):

  ```bash
  export STORMPATH_CLIENT_APIKEY_ID=xxx
  export STORMPATH_CLIENT_APIKEY_SECRET=xxx
  export STORMPATH_APPLICATION_HREF=xxx
  ```

2. Start the server:

  ```bash
  pm2 server.js
  ```

5. Visit [http://localhost:4000/](http://localhost:4000/) in your browser
