import { TestBed } from '@angular/core/testing';

import { CuentaUsuariF } from './cuenta-usuari-f';

describe('CuentaUsuariF', () => {
  let service: CuentaUsuariF;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CuentaUsuariF);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
