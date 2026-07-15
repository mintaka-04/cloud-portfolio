import { section, text, image, imageUrl, subLabel, badge, table, criteriaGrid } from '../components/render.js';

export default {
  version: 'v2.0',
  title: 'ECS Fargate 전환 및 Auto Scaling 적용',
  status: 'shipped',
  tags: ['ECS', 'AWS Fargate', 'Auto Scaling', 'Supabase Realtime'],
  prev: '1.1',
  next: '3.0',

  sections: [

    // 01 아키텍처
    section(1, '아키텍처', `
      ${text([
        'EC2 기반으로 동작하던 인스턴스들을 ECS Fargate 기반의 아키텍처로 전환하였습니다.',
        'Main은 단일 Task로 유지하였으며, Worker는 ECS Service로 구성하여 부하에 따라 수가 자동으로 증감하도록 Autoscaling을 적용하였습니다.',
      ])}
      ${imageUrl('../../assets/images/bottleneck_experiments/v3/v3-diagram.png', 'v2.0 아키텍처 다이어그램')}
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      ${text('이전 테스트에서 Worker의 처리량을 개선시킬 필요성을 느꼈으며, Worker의 수를 증가시키는 방법이 가장 간단하다고 판단하여 먼저 해당 방법을 검증하였습니다.')}
      ${badge('첫 번째 시도', text([
        '동일한 EC2 인스턴스에서 Worker를 2개로 증가시킨 결과 CPU가 안정적으로 유지되는 것을 확인했지만 여전히 SQS Backlog가 지속적으로 증가하는 것을 확인하였습니다.',
        '따라서 처리량은 일부 개선되었지만 여전히 요청량을 따라가기에는 부족하다고 판단하였습니다.',
      ]))}
      ${badge('두 번째 시도', text([
        '더 많은 처리량을 위해 동일한 EC2 인스턴스에서 Worker를 4개로 증가시켜보았지만 SQS Backlog 처리 시도 중 CPU가 다시 포화되었으며, 이전과 동일하게 인스턴스 장애가 발생하였습니다.',
        '이를 통해 동일한 EC2 환경에서는 Worker를 계속 늘리는 방식에 한계가 있다는 것을 확인했습니다.',
      ]))}
      ${text('이에 따라 Worker의 수를 유연하게 증가시킬 수 있는 환경이 필요하다고 판단했으며, 이를 위해 ECS Fargate를 도입하게 되었습니다.')}
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${text([
        '테스트 시나리오와 사용 데이터는 이전과 동일하게 유지하였습니다.',
        '하지만 구조가 변경됨에 따라 추가적인 관찰 지표가 필요하다고 판단해 다음과 같이 관찰 지표와 판단 기준을 추가하였습니다.',
        '또한 autoscaling 정책은 CPU가 안정적으로 유지되었던 Worker 2개 환경 테스트 결과를 바탕으로 초기값을 설정하였습니다.',
      ])}
      ${subLabel('테스트 상세', `
        ${badge('베이스라인 테스트', '<p class="body-text">단일 사용자가 사용한다는 가정 하에 기본 성능을 측정하였습니다.</p>')}
        ${badge('점진적 부하 테스트', '<p class="body-text">동시 사용자 수(VUs)를 10 → 30 → 50 → 100으로 단계적으로 증가시켰습니다.</p>')}
      `)}
      ${subLabel('관찰 지표', `
        ${badge('SQS 지표 (입력)', `
          <ul>
            <li>Approximate Number Of Messages Visible (backlog)</li>
            <li>Approximate Number Of Messages Not Visible</li>
            <li>메시지 처리 지연 시간 (max, p95, avg)</li>
          </ul>
        `)}
        ${badge('ECS 지표 (반응)', `
          <ul>
            <li>Running Task Count</li>
            <li>Desired Task Count</li>
            <li>Scaling 이벤트 발생 시점</li>
            <li>Scale-out / Scale-in 속도</li>
          </ul>
        `)}
        ${badge('애플리케이션 지표', `
          <ul>
            <li>지연율 (avg, p95)</li>
            <li>에러 발생률</li>
          </ul>
        `)}
      `)}
      ${subLabel('Auto Scaling 초기 설정', `
        ${text([
          'Auto Scaling은 개별 요청의 지연보다는 시스템이 Backlog 증가를 얼마나 빠르게 감지하고 대응할 수 있는지를 기준으로 설정하였습니다.',
          '이전 테스트 결과를 바탕으로<span style="color:var(--ink-soft); opacity:.55; font-size:13px;">(이전 테스트 결과 중 Approximate Number Of Messages Visible)</span> Worker 1개당 초당 약 24건의 처리가 추가로 필요하다고 추정하였고, Auto Scaling이 실제로 동작하기까지 일정 시간이 필요하므로, Backlog 증가를 약 10초까지 허용하는 것을 목표로 설정하였습니다.',
        ])}
        ${table({
          head: ['항목', '초기 설정'],
          rows: [
            { cells: ['Scale-out/in Threshold', '240/80'] },
            { cells: ['Detection Period', '10초'] },
            { cells: ['Scale-out/in Step', '+3 / -1'] },
            { cells: ['Min/Max Worker', '1/20'] },
            { cells: ['Scale-out/in Cooldown', '30초/120초'] },
          ]
        })}
      `)}
      ${subLabel('초기 설정 검토 및 재조정', `
        ${text([
          '초기 정책을 검토하는 과정에서 SQS CloudWatch Metric은 사용자가 설정한 감지 주기와 관계없이 최소 60초 단위로 집계되는 관리형 메트릭이라는 것을 확인했습니다.',
          '따라서 감지 주기를 10초로 설정하더라도 동일한 메트릭 값을 반복적으로 참조하기 때문에 예상했던 시점에 Scale-out이 수행되지 않는다는 문제를 발견했습니다.',
          '이에 따라 Backlog 증가를 60초까지 허용하는 것으로 다시 계산하였으며, 이에 따라 다른 초기값들도 다음과 같이 변경하였습니다.',
        ])}
        ${table({
          head: ['항목', '초기 설정', '변경값'],
          rows: [
            { cells: ['Scale-out/in Threshold', '240/80', '1440/500'] },
            { cells: ['Detection Period', '10초', '60초'] },
            { cells: ['Scale-out/in Cooldown', '30초/120초', '60초/180초'] },
          ]
        })}
      `)}
      ${subLabel('판단 기준', `
        ${criteriaGrid({
          left: {
            title: '임계점',
            items: ['avg 또는 p95가 베이스라인 대비 2배 증가', 'task 증가에도 Backlog 느리게 감소 <span class="new-tag">NEW</span>', '에러율 1~2%', 'CPU 70~80% 지속']
          },
          right: {
            title: '한계점',
            items: ['avg 또는 p95가 베이스라인 대비 4배 증가', 'task 증가에도 Backlog가 지속적으로 증가 <span class="new-tag">NEW</span>', '에러율 5% 이상 지속', 'CPU 90% 이상 또는 OOM']
          }
        })}
      `)}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${subLabel('베이스라인 테스트', `
        ${table({
          head: ['회차', 'avg (s)', 'p95 (s)', '에러율'],
          rows: [
            { cells: ['1', '1.82', '1.89', '0%'] },
            { cells: ['2', '1.66', '1.81', '0%'] },
            { cells: ['3', '0.86', '0.89', '0%'] },
            { cells: ['4', '0.98', '1.01', '0%'] },
            { cells: ['5', '1.00', '1.16', '0%'] },
            { cells: ['6', '0.93', '1.01', '0%'] },
            { cells: ['7', '0.89', '0.96', '0%'] },
            { cells: ['8', '1.20', '1.35', '0%'] },
            { cells: ['9', '0.76', '0.78', '0%'] },
            { cells: ['10', '0.86', '0.93', '0%'] },
            { cells: ['평균 (3~10회)', '0.94', '1.01', '0%'], highlight: true },
          ]
        })}
        <p class="body-text" style="margin-top:12px;">1, 2회차는 cold start로 추정하여 제외하였습니다. 데이터가 안정된 3~10회차 평균을 베이스라인으로 설정하였습니다.</p>
      `)}
      ${subLabel('점진적 부하 테스트', `
        ${badge('애플리케이션 지표', `
          ${table({
            head: ['지표', '결과'],
            rows: [
              { cells: ['avg', '800ms'] },
              { cells: ['p95', '928ms'] },
              { cells: ['에러율', '0.009%'] },
            ]
          })}
          ${imageUrl('../../assets/images/bottleneck_experiments/v3/v3-request-failed-rate.png', 'Request Failed Rate 그래프')}
          <p class="body-text" style="margin-top:12px;">평균 응답시간과 p95는 베이스라인과 큰 차이를 보이지 않았지만 테스트 중 HTTP 500 에러가 3건 발생하였습니다.</p>
        `, 48)}
        ${badge('SQS 지표', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v3/v3-sqs.png', 'SQS 지표 그래프')}
          <p class="body-text" style="margin-top:12px;">Auto Scaling 동작을 확인하기 위해 SQS 지표를 분석했으나 Queue로 전송된 메시지 수가 예상보다 매우 적었으며 Backlog 또한 이전 부하테스트 대비 현저히 적은 수준으로 유지되는 것을 확인할 수 있었습니다.</p>
          <p class="body-text" style="margin-top:12px;">따라서 Queue 이전 단계에서 요청이 정상적으로 처리되고 있는지 확인하기 위해 Main 서비스의 CPU 및 메모리 사용률을 확인하였습니다.</p>
        `)}
        ${badge('ECS 지표', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v3/v3-cpu-memory.png', 'ECS CPU 및 메모리 사용률 그래프')}
          <p class="body-text" style="margin-top:12px;">Main 서비스의 CPU 및 메모리 사용률 모두 낮은 수준을 유지하고 있었으며 테스트 동안 큰 변동 또한 확인되지 않았습니다.</p>
          <p class="body-text" style="margin-top:12px;">따라서 요청이 정상적으로 처리되고 있는지 확인하기 위하여 DB 로그를 분석하였습니다.</p>
        `)}
        ${badge('DB 로그', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v3/v3-db-timeout.png', 'DB 로그 타임아웃 그래프')}
          ${imageUrl('../../assets/images/bottleneck_experiments/v3/v3-slow-query.png', 'Slow Queries 그래프')}
          <p class="body-text" style="margin-top:12px;">요청 증가시 PostgreSQL 로그에서는 명확한 에러가 확인되지 않았으나 PostgREST 에서는 Thread killed by timeout manager 에러가 연속적으로 발생하는 것을 발견하였습니다.</p>
          <p class="body-text" style="margin-top:12px;">또한 원인을 추가로 분석하기 위해 Supabase Observability의 Slow Queries를 확인한 결과 realtime.list_changes 쿼리가 Slow Queries에서 가장 큰 비중을 차지하는 것을 확인할 수 있었습니다.</p>
        `)}
      `)}
    `),

    // 05 판단
    section(5, '판단 및 이유', `
      ${text([
        'Queue로 전송된 메시지 수와 Backlog가 예상보다 적었던 점에서 병목은 SQS 이전 단계에서 발생한 것으로 판단하였습니다.',
        '그러나 Main 서비스의 리소스 사용량을 확인한 결과 CPU 및 메모리 사용률 모두 낮은 수준을 유지하고 있었으므로 Main 서비스의 리소스 부족으로 처리가 지연된 것으로 보기는 어려웠습니다.',
        '이후 Main 서비스의 DB 로그를 확인한 결과 PostgREST에서 thread killed by timeout manager 에러가 연속적으로 발생하는 것을 발견해 요청 처리 지연은 DB 처리 과정에서 일어났다고 판단하였습니다.',
      ])}
      <p class="body-text" style="margin-top:24px;">더 정확한 원인을 파악하기 위해 Slow Queries 분석 결과, realtime.list_changes 쿼리가 가장 큰 비중을 차지하는 것을 확인할 수 있었습니다.</p>
      ${text([
        '해당 쿼리는 Supabase Realtime이 WAL 기반 변경 감지를 위해 지속적으로 실행하는 내부 쿼리이며, 현재 버전은 Vercel에서 API를 통해 특정 테이블의 데이터가 변경되면 Supabase Realtime이 이를 감지하여 Main 서비스로 전달하는 방식으로 구성되어있습니다.',
        '즉, 부하 상황에서 realtime.list_changes 쿼리가 DB 리소스를 지속적으로 사용하면서 다른 요청의 처리가 지연되었을 가능성이 높은 것으로 판단하였습니다.',
        '그 결과 요청이 증가 -> DB 처리가 지연 -> PostgREST의 worker 점유가 지속 -> 내부 요청 누적 -> timeout 발생의 흐름으로 문제가 발생한 것으로 판단하였습니다.',
      ])}
    `),

    // 06 개선 방향
    section(6, '개선 방향', `
      ${text([
        '해당 버전은 Supabase Realtime을 이벤트 트리거로 사용하고 있어 이벤트 처리 과정이 DB와 강하게 결합되어 있었습니다.',
        '따라서 DB는 데이터 저장에 집중하고 이벤트 처리는 별도로 수행할 수 있도록 Realtime 기반 트리거를 제거한 뒤 이벤트를 메시지 큐에 적재하는 구조로 개선하기로 결정하였습니다.',
      ])}
    `),
  ]
};
