process.env.NODE_ENV = 'test';
process.env.IS_TEST = 'true';

import './critical-business-rules.test';
import './smart-recommendation-and-audit.test';
import './pdf-generation.test';
