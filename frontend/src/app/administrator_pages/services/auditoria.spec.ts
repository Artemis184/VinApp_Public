import { TestBed } from '@angular/core/testing';

import { Auditoria } from './auditoria';

describe('Auditoria', () => {
  let service: Auditoria;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Auditoria);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
