import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { Controller, INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { RequestQueryBuilder } from '@nestjsx/crud-request';

import { Crud, Override, ParsedRequest, ParsedBody } from '../src/decorators';
import { CrudRequest, CreateManyDto } from '../src/interfaces';
import { R, Swagger } from '../src/crud';
import { CrudActions } from '../src/enums';
import { HttpExceptionFilter } from './__fixture__/exception.filter';
import { TestModel } from './__fixture__/test.model';
import { TestService } from './__fixture__/test.service';

describe('#crud', () => {
  describe('#override methods', () => {
    let app: INestApplication;
    let server: any;
    let qb: RequestQueryBuilder;

    @Crud({
      model: { type: TestModel },
    })
    @Controller('test')
    class TestController {
      constructor(public service: TestService<TestModel>) {}

      @Override()
      getMany(@ParsedRequest() req: CrudRequest) {
        return { foo: 'bar' };
      }

      @Override('createManyBase')
      createBulk(
        @ParsedBody() dto: CreateManyDto<TestModel>,
        @ParsedRequest() req: CrudRequest,
      ) {
        return { dto, req };
      }
    }

    beforeAll(async () => {
      const fixture = await Test.createTestingModule({
        controllers: [TestController],
        providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }, TestService],
      }).compile();

      app = fixture.createNestApplication();

      await app.init();
      server = app.getHttpServer();
    });

    beforeEach(() => {
      qb = RequestQueryBuilder.create();
    });

    afterAll(async () => {
      app.close();
    });

    describe('#override getMany', () => {
      it('should return status 200', (done) => {
        return request(server)
          .get('/test')
          .expect(200)
          .end((_, res) => {
            const expected = { foo: 'bar' };
            expect(res.body).toMatchObject(expected);
            done();
          });
      });
      it('should return status 400', (done) => {
        const query = qb.setFilter({ field: 'foo', operator: 'gt' }).query();
        return request(server)
          .get('/test')
          .query(query)
          .expect(500)
          .end((_, res) => {
            const expected = { statusCode: 400, message: 'Invalid filter value' };
            expect(res.body).toMatchObject(expected);
            done();
          });
      });
      it('should have action metadata', () => {
        const action = R.getAction(TestController.prototype.getMany);
        expect(action).toBe(CrudActions.ReadAll);
      });
      it('should return swagger operation', () => {
        const operation = Swagger.getOperation(TestController.prototype.getMany);
        const expected = { summary: 'Retrieve many TestModel' };
        expect(operation).toMatchObject(expected);
      });
      it('should return swagger params', () => {
        const params = Swagger.getParams(TestController.prototype.getMany);
        expect(Array.isArray(params)).toBe(true);
        expect(params.length > 0).toBe(true);
      });
      it('should return swagger response ok', () => {
        const response = Swagger.getResponseOk(TestController.prototype.getMany);
        const expected = { '200': { type: TestModel, isArray: true, description: '' } };
        expect(response).toMatchObject(expected);
      });
    });

    describe('#override createMany', () => {
      it('should still validate dto', (done) => {
        const send: CreateManyDto<TestModel> = {
          bulk: [],
        };
        return request(server)
          .post('/test/bulk')
          .send(send)
          .expect(400)
          .end((_, res) => {
            expect(res.body.message[0].property).toBe('bulk');
            done();
          });
      });
      it('should return status 201', (done) => {
        const send: CreateManyDto<TestModel> = {
          bulk: [
            {
              firstName: 'firstName',
              lastName: 'lastName',
              email: 'test@test.com',
              age: 15,
            },
            {
              firstName: 'firstName',
              lastName: 'lastName',
              email: 'test@test.com',
              age: 15,
            },
          ],
        };
        return request(server)
          .post('/test/bulk')
          .send(send)
          .expect(201)
          .end((_, res) => {
            expect(res.body).toHaveProperty('req');
            expect(res.body).toHaveProperty('dto');
            expect(res.body.dto).toMatchObject(send);
            done();
          });
      });
    });
  });
});
