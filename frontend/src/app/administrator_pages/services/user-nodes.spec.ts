import { TestBed } from '@angular/core/testing';

import { UserNodes } from './user-nodes';

describe('UserNodes', () => {
  let service: UserNodes;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserNodes);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
