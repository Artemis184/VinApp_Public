import { TestBed } from '@angular/core/testing';

import { UsuPendientes } from './usu-pendientes';

describe('UsuPendientes', () => {
  let service: UsuPendientes;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UsuPendientes);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
