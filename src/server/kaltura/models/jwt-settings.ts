import { BaseImmutable, Property, isInstanceOf } from 'immutable-class';



export interface JwtSettingsValue {
  kalturaApiUri: string;
  jwtSecret: string;
  jwtExpiration: string;
}

export interface JwtSettingsJS {
  kalturaApiUri: string;
  jwtSecret: string;
  jwtExpiration: string;
}

export class JWTSettings extends BaseImmutable<JwtSettingsValue, JwtSettingsJS> {

  static isJWTSettings(candidate: any): candidate is JWTSettings {
    return isInstanceOf(candidate, JWTSettings);
  }

  static fromJS(parameters: JwtSettingsJS): JWTSettings {
    return new JWTSettings(BaseImmutable.jsToValue(JWTSettings.PROPERTIES, parameters));
  }

  static PROPERTIES: Property[] = [
    { name: 'jwtSecret' },
    { name: 'kalturaApiUri' },
    { name: 'jwtExpiration' }
  ];

  public jwtSecret: string;
  public kalturaApiUri: string;
  public jwtExpiration: string;

  constructor(parameters: JwtSettingsValue) {
    super(parameters);
  }

  public getJwtSecret: () => string;
  public getJwtExpiration: () => number;
}

BaseImmutable.finalize(JWTSettings);
