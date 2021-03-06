import { MigrationInterface, QueryRunner } from 'typeorm'

export class PriceHistory1603980121443 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP FUNCTION IF EXISTS public.priceHistory;')
    await queryRunner.query(`
CREATE OR REPLACE FUNCTION public.priceHistory(_token varchar, _from timestamp, _to timestamp, _interval integer)
  RETURNS TABLE ("timestamp" timestamp, "price" numeric)
  LANGUAGE 'plpgsql'
  VOLATILE 
AS $BODY$
DECLARE
  timeIterator timestamp := _from;
  timeIteratorNext timestamp;
BEGIN
  LOOP
    timeIteratorNext := timeIterator + (_interval * interval '1 minute');

    RETURN QUERY
    SELECT
      timeIterator as "timestamp",
      p.close as price
    FROM price p
    WHERE p.token = _token AND p.datetime <= timeIteratorNext
    ORDER BY p.datetime DESC LIMIT 1;

    EXIT WHEN timeIterator >= _to;

    timeIterator := timeIteratorNext;
  END LOOP;

END;
$BODY$;
`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP FUNCTION public.priceHistory;')
  }
}
