import { Router, Request, Response } from 'express';
import { LOGGER } from 'logger-tracker';
import { SERVER_SETTINGS } from '../../config';
import * as jwt from 'jsonwebtoken';
import * as request from 'request';

var router = Router();

router.all('/authenticate', (req: Request, res: Response) => {

  const jwtSecret = SERVER_SETTINGS.jwt.jwtSecret;
  const kalturaApiEndpoint = SERVER_SETTINGS.jwt.kalturaApiUri;
  const allowedPartners = SERVER_SETTINGS.jwt.allowedPartners ? (String(SERVER_SETTINGS.jwt.allowedPartners) || '').replace(' ', '').trim().split(',') : null;
  const requiredPermission = SERVER_SETTINGS.jwt.requiredPermission ? (String(SERVER_SETTINGS.jwt.requiredPermission) || '').trim() : null;
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
        url: kalturaApiEndpoint + "/api_v3/service/multirequest?format=1",
        json: true,
        body: {
          apiVersion: "3.3.0",
          clientTag: "swiv-kmc-analytics",
          ks: ks,
          1: {
              'service': 'user',
              'action': 'get'
          },
          2: {
              'service': 'permission',
              'action': 'getCurrentPermissions'
          }
        }
      }, (error, response, body) => {
        let resp: any;

        try {
          if (error) {
            resp = error;
          } else if (body) {
            if (body[0].objectType === 'KalturaUser') {
              resp = body[0];
              resp.permissions = (typeof body[1] === 'string') ? body[1] : '';
            } else {
              resp = new Error('got unknown response from server');
            }
          } else {
            resp = new Error('got empty response from server');
          }
        } catch (e) {
          resp = e;
        }

        if (!resp || resp instanceof Error) {
          LOGGER.warn(`failed to authenticate user with error: ${resp.message}`);
          res.status(401).send({
            error: 'provided ks is invalid or expired'
          });
          return;
        } else {
          if (allowedPartners && allowedPartners.length && resp
            && allowedPartners.indexOf(String(resp.partnerId)) === -1) {
            LOGGER.warn(`trying to authenticate with partner ${resp.partnerId} which is not allowed by configuration`);
            res.status(401).send({
              error: 'provided ks is not allowed'
            });
            return;
          }

          if (requiredPermission &&
            resp.permissions.split(',').indexOf(requiredPermission) < 0) {
            LOGGER.warn(`user does not have analytics permission`);
            res.status(401).send({
              error: 'provided ks is not allowed'
            });
            return;
          }

          // ks is valid, create a jwt token
          const payload: Object = {
            partnerId: resp.partnerId,
            userId: resp.id,
            ks
          };

          var token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiration });

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
