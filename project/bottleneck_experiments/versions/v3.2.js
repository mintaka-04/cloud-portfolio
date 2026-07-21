import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip, note } from '../components/render.js';

export default {
  version: 'v3.2',
  title: 'PostgREST 제거 및 CTE 기반 쿼리 최적화',
  status: 'in progress',
  tags: ['asyncpg', 'CTE', 'DB Connection Pooler'],
  prev: '3.1',
  next: null,

  sections: [

    // 01 아키텍처
    section(1, '아키텍처', `
      ${text('rule-worker를 supabase-py에서 asyncpg 기반으로 전환하고, Transaction Pooler를 적용하였습니다.')}
      ${imageUrl('../../assets/images/bottleneck_experiments/v6/v6-before-after.png', 'before/after 아키텍처 다이어그램')}
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      ${text([
        '이전 테스트에서 메시지 처리 과정의 DB 요청 수를 줄이고 Connection Pool Size를 조정하는 방향으로 개선하기로 결정하였습니다.',
        '그러나 기존에 사용하던 supabase-py에서는 커스텀 SQL을 직접 실행하기가 어려웠기 때문에 DB 호출 수를 줄이기 위해 RPC(Remote Procedure Call)를 사용하기로 했습니다. 또한 Connection Pool Size 조정 가능 여부를 확인한 결과, Supabase Nano 플랜에서는 Connection Pool Size 확장에 제한이 있었으며, 충분한 Pool Size 확보를 위해서는 상위 플랜으로 전환해야 했습니다.',
        '따라서 PostgREST Connection Pool에 대한 의존성을 줄이기 위해 구조를 변경하기로 결정하였으며, 이를 위해 asyncpg 기반의 PostgreSQL Direct Connection 적용을 검토하였습니다. 하지만 ECS Fargate 환경에서 Direct Connection Host에 대한 DNS Resolution 문제가 발생해 Direct Connection을 사용할 수 없었습니다.',
        '이에 따라 PgBouncer 적용을 고려하게 되었고 Session Pooler와 Transaction Pooler를 비교 검토하였습니다. Session Pooler는 클라이언트 연결 수만큼 PostgreSQL Connection이 필요하므로 Auto Scaling 환경에서는 효율적이지 않다고 판단하였습니다. 반면 Transaction Pooler는 제한된 PostgreSQL Connection을 여러 클라이언트가 공유하여 사용할 수 있으므로 현재 구조에 적합하다고 판단하여 Transaction Pooler(PgBouncer)를 적용하였습니다.',
        '또한 asyncpg 기반으로 PostgreSQL에 직접 SQL을 실행할 수 있게 되었기 때문에 별도의 PostgreSQL 함수를 관리해야 하는 RPC 대신 CTE를 적용하기로 하였습니다.',
      ])}
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${text('DB 접근 방식(asyncpg + Transaction Pooler)과 SQL 실행 구조(CTE)를 제외한 모든 실험 조건은 이전 버전과 동일하게 유지하여 부하 테스트를 수행하였습니다.')}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${subLabel('베이스라인 테스트', `
        ${table({
          head: ['회차', 'avg (s)', 'p95 (s)', '에러율'],
          rows: [
            { cells: ['1', '1.64', '1.93', '0%'] },
            { cells: ['2', '1.06', '1.28', '0%'] },
            { cells: ['3', '1.04', '1.25', '0%'] },
            { cells: ['4', '1.01', '1.19', '0%'] },
            { cells: ['5', '1.01', '1.24', '0%'] },
            { cells: ['6', '0.93', '1.02', '0%'] },
            { cells: ['7', '0.91', '1.00', '0%'] },
            { cells: ['8', '1.06', '1.28', '0%'] },
            { cells: ['9', '1.10', '1.27', '0%'] },
            { cells: ['10', '0.92', '1.00', '0%'] },
            { cells: ['평균 (2~10회)', '1.00', '1.17', '0%'], highlight: true },
          ]
        })}
        <p class="body-text" style="margin-top:12px;">1회차를 cold start로 추정하여 제외하였습니다. 데이터가 안정된 2~10회차 평균을 베이스라인으로 설정하였습니다.</p>
      `)}
      ${subLabel('점진적 부하 테스트', `
        ${badge('애플리케이션 지표', `
          ${table({
            head: ['시각', 'VU', 'avg', 'p95', '상태'],
            rows: [
              { cells: ['15:25~15:31', '10→30', '0.93s', '~1.2s', '안정'] },
              { cells: ['15:31', '30', '1.13s', '1.22s', '성능 저하 조짐'] },
              { cells: ['15:32', '30→50 램프업', '24.4s', '-', '붕괴'], highlight: true },
              { cells: ['15:32~15:35', '50', '9~22s', '15~54s', '지연'] },
              { cells: ['15:35~15:37', '50→100', '47~55s', '58s', '포화'] },
              { cells: ['15:37~15:40', '100', '49~60s', 'timeout', '장애'] },
            ]
          })}
          <p class="body-text" style="margin-top:12px;">30VU까지는 정상동작했으나 50VU로 램프업 하는 시점에 즉시 붕괴가 발생했습니다.</p>
        `)}
        ${badge('DB 지표', `
          ${table({
            head: ['시각', 'DB connections', 'DB CPU'],
            rows: [
              { cells: ['~15:28', '~15', '~1%'] },
              { cells: ['15:28~', '~30', '16~19%'] },
              { cells: ['15:32~', '~45', '28.57%'] },
              { cells: ['15:45', '-', '7.84%'] },
            ]
          })}
          <p class="body-text" style="margin-top:12px;">15:33 ~ 15:42 구간에서는 DB 모니터링 데이터가 수집되지 않았으며, 해당 구간의 DB 상태는 확인할 수 없었습니다.</p>
          ${imageUrl('../../assets/images/bottleneck_experiments/v6/v6-db-memory.png', 'DB Memory Commitment / Swap Memory 그래프')}
          <p class="body-text" style="margin-top:12px;">Memory Commitment는 테스트와 관계없이 지속적으로 limit에 근접한 상태를 유지하고 있었으며, Swap Memory 사용률 역시 부하와 무관하게 50% 수준으로 유지되었습니다.</p>
        `)}
        ${badge('Slow Query', `
          ${table({
            head: ['순위', '비율', '쿼리'],
            rows: [
              { cells: ['1', '52.3%', 'rule-worker CTE (_build_context)'] },
              { cells: ['2', '14.3%', 'ai-worker PostgREST'] },
            ]
          })}
          <p class="body-text" style="margin-top:12px;">해당 버전에서 적용한 _build_context CTE가 전체 실행 시간의 52.3%를 차지하는 것을 확인할 수 있었습니다.</p>
        `)}
      `)}
    `),

    // 05 판단 및 이유
    section(5, '판단 및 이유', `
      ${text([
        'Memory Commitment가 평상시에도 한계에 근접했으며, Swap Memory도 지속적으로 사용되고 있었습니다. 이를 통해 Supabase Nano 환경은 테스트 이전부터 시스템 자원이 충분하지 않은 상태였던 것으로 판단하였습니다.',
        '또한 ai-worker는 여전히 PostgREST 기반으로 DB를 호출하고 있어 HTTP 기반 처리 비용이 지속적으로 발생하는 구조였습니다.',
        '따라서 현재 구조에서는 SQL 최적화만으로는 성능 개선에 한계가 있으며, DB 실행 환경 자체를 개선할 필요가 있다고 판단하였습니다.',
      ])}
    `),

    // 06 개선 방향
    section(6, '개선 방향', `
      ${text([
        '애플리케이션 DB를 AWS RDS로 이전하여, Supabase는 Auth와 Storage 기능만 사용하도록 구조를 변경하는 방향으로 진행하기로 결정했습니다.',
        '또한 ai-worker도 asyncpg 기반으로 전환하여 PostgREST를 거치지 않고 DB에 직접 접근하도록 변경하기로 했습니다.',
      ])}
    `),
  ]
};
