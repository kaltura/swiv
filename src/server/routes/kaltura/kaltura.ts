import { Router, Request, Response } from 'express';
import { LOGGER } from 'logger-tracker';
import { SERVER_SETTINGS } from '../../config';
import * as jwt from 'jsonwebtoken';
import * as request from 'request';

var router = Router();

router.all('/authenticate', (req: Request, res: Response) => {

  const jwtSecret = SERVER_SETTINGS.jwt.jwtSecret;
  const kalturaApiEndpoint = SERVER_SETTINGS.jwt.kalturaApiUri;
  const jwtExpiration = SERVER_SETTINGS.jwt.jwtExpiration || '1d';
  const ks = req.body.ks || req.query.ks;


  if (!jwtSecret || !kalturaApiEndpoint) {
    res.status(500).send({
      error: 'server configuration invalid.'
    });
  }else if (ks) {
    request(
      {
        method: 'POST',
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        url: kalturaApiEndpoint + "/api_v3/service/user/action/get?format=1",
        json: true,
        body: {
          apiVersion: "3.3.0",
          clientTag: "swiv-kmc-analytics",
          ks: ks
        }
      }, (error, response, body) => {
        let resp: any;

        try {
          if (error) {
            resp = error;
          }else if (body) {
            resp = body.objectType === 'KalturaUser' ?
              body :
              new Error('got unknown response from server');
          }else {
            resp = new Error('got empty response from server');
          }
        } catch (e) {
          resp = e;
        }

        LOGGER.log(JSON.stringify(resp));

        if (!resp || resp instanceof Error) {
          LOGGER.warn(`failed to authenticate user with error: ${resp.message}`);
          res.status(401).send({
            error: 'provided ks is invalid or expired'
          });
        } else {
          // ks is valid, create a jwt token
          const payload: Object = {
            partnerId: resp.partnerId,
            ks
          };

          var token = jwt.sign(payload, jwtSecret, { expiresIn : jwtExpiration });

          res.json({
            success: true,
            token: token
          });
        }
      });
  } else {
    res.status(403).send({
      error: 'No ks provided.'
    });
  }
});

export = router;
