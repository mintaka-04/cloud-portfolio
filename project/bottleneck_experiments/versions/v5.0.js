import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip, note } from '../components/render.js';

export default {
  version: 'v5.0',
  title: 'RDS Connection Capacity 한계 확인',
  status: 'shipped',
  tags: ['Soak Test', 'AWS RDS', 'DB Connection Pool'],
  prev: '4.3',
  next: '5.1',

  sections: [

    // 01 운영 환경 구성
    section(1, '운영 환경 구성', `
      ${text('4.3버전과 동일한 환경을 유지하였습니다.')}
    `),

    // 02 실험 설계
    section(2, '실험 설계', `
      ${text([
        '이전 버전에서 급격한 부하 변화와 장시간 부하 환경에서도 안정적으로 동작하는지 검증하기 위해 Spike Test와 Soak Test를 수행하기로 결정하였습니다. 이전 테스트 결과를 통해 100 VU를 최대 운영 부하 수준이라고 판단했기 때문에 Spike Test에서도 100 VU를 트래픽 급증 상황으로 정의하였습니다. 하지만 이전 점진적 부하 테스트에서 100 VU를 약 3분간 유지하는 구간이 이미 포함되어 있었으며, 본 서비스는 메모 기록 서비스의 특성상 이벤트성 대규모 트래픽이 발생할 가능성이 낮아 Spike Test를 별도로 수행하더라도 새로운 검증 결과를 얻기 어렵다고 판단하였습니다. 따라서 장시간 운영 시의 안정성을 검증하기 위해 Soak Test만 수행하기로 결정하였습니다.',
        'Soak Test에서는 기존 점진적 부하 테스트와의 결과 비교가 가능하도록 사용 데이터, 테스트 도구(k6), 판단 기준을 동일하게 유지하였습니다. 또한 점진적 부하 테스트에서 50 VU 구간까지 시스템이 안정적으로 부하를 처리하는 것을 확인했기 때문에, 50 VU를 지속 부하로 선정하였습니다.',
        '또한 점진적 부하 테스트는 최대 15분 동안 수행되었기 때문에, 해당 테스트에서 확인하기 어려운 지속적인 리소스 누적이나 장시간 안정성을 확인하기 위해 15분보다 긴 관찰 시간이 필요하다고 판단하였습니다. 따라서 테스트 목적에 필요한 관찰 시간을 확보하면서 불필요하게 테스트 시간을 늘리지 않도록 이전 테스트 결과를 고려하여 50 VU를 30분간 유지하도록 Soak Test를 설계하였습니다.',
      ])}
    `),

    // 03 실험 결과
    section(3, '실험 결과', `
      ${subLabel('Soak 테스트', `
        ${badge('애플리케이션 지표', `
          ${table({
            head: ['지표', '결과'],
            rows: [
              { cells: ['avg', '0.84'] },
              { cells: ['p95', '1.00'] },
              { cells: ['에러율', '0.4%'] },
            ]
          })}
        `)}
        ${badge('RDS 지표', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v11/v11-dbconnections.png', 'RDS DB Connections 그래프')}
        `, 32)}
        ${note(`2026-08-07 06:49:32 UTC:172.31.8.184(59334):moodotclone_adm@postgres:[26661]:FATAL:  remaining connection slots are reserved for roles with privileges of the "rds_reserved" role<br>
... (총 2,437회 반복)<br>
<br>
2026-08-07 06:56:08 UTC:172.31.22.212(53432):moodotclone_adm@postgres:[27549]:FATAL:  sorry, too many clients already<br>
... (총 8회 반복)`)}
        <div style="margin-top:16px;">
          ${text('DB Connections는 지속적으로 증가하다 70~74 수준에서 유지되었으며, 해당 시점부터 위의 로그와 같이 다수의 FATAL 로그가 발생하는 것을 확인하였습니다.')}
        </div>
        ${badge('queue 관련 cloudwatch 지표', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v11/v11-event-queue-visible.png', 'event-queue Approximate Number Of Messages Visible 그래프')}
          <p class="body-text" style="margin-top:8px; text-align:center;">(event-queue)</p>
          ${imageUrl('../../assets/images/bottleneck_experiments/v11/v11-ai-queue-visible.png', 'ai-queue Approximate Number Of Messages Visible 그래프')}
          <p class="body-text" style="margin-top:8px; text-align:center;">(ai-queue)</p>
        `, 32)}
        <div style="margin-top:16px;">
          ${text('event-queue의 backlog는 테스트 초반 최대 6건까지 증가했으나 이후 구간에서는 대부분 0 수준을 유지하였습니다. 반면 ai-queue의 backlog는 테스트 시작 이후 지속적으로 증가하는 것을 확인할 수 있었습니다.')}
        </div>
        ${badge('worker 관련 cloudwatch 지표', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v11/v11-rule-worker-task.png', 'rule-worker Task Count 그래프')}
          <p class="body-text" style="margin-top:8px; text-align:center;">(rule-worker)</p>
          ${imageUrl('../../assets/images/bottleneck_experiments/v11/v11-ai-worker-task.png', 'ai-worker Task Count 그래프')}
          <p class="body-text" style="margin-top:8px; text-align:center;">(ai-worker)</p>
        `, 32)}
        <div style="margin-top:16px;">
          ${text('rule-worker와 ai-worker의 Task 수는 테스트 시작 이후 Auto Scaling 정책에 따라 지속적으로 증가하였습니다.')}
        </div>
      `)}
    `),

    // 04 판단 및 이유
    section(4, '판단 및 이유', `
      ${imageUrl('../../assets/images/bottleneck_experiments/v11/v11-k6-request-duration.png', 'HTTP Request Duration 그래프')}
      <div style="margin-top:20px;">
        ${imageUrl('../../assets/images/bottleneck_experiments/v11/v11-k6-request-waiting.png', 'HTTP Request Waiting 그래프')}
      </div>
      <div style="margin-top:20px;">
        ${text([
          'Soak Test 결과 애플리케이션 지표에서 request failed rate가 확인되어 k6 결과를 확인한 결과, duration 중 request waiting이 높은 비율을 차지하는 것을 확인하였습니다. 이러한 경향은 이전 버전(<a href="template.html?v=3.1#section-05" style="color:var(--blue); text-decoration:underline;">v3.1</a>)에서도 한 차례 나타난 적이 있었으며, 당시 원인이 외부 응답을 기다리는 대기 시간이었고 그 외부 응답이 DB였다는 점에서 이번에도 RDS를 확인하였습니다.',
          '그 결과 RDS 로그에서 FATAL이 처음 발생한 시점이 DatabaseConnections가 약 73까지 증가한 시점과 일치한다는 것을 확인했습니다. 하지만 동일 시점의 Queue나 Worker 지표에서는 특별한 이상 징후를 발견할 수 없었기 때문에, 해당 지표만으로는 FATAL의 발생 원인을 특정하기 어려웠습니다. 반면 DatabaseConnections는 70 ~ 74까지 증가한 이후 해당 구간에서 유지되는 경향을 보였기 때문에, RDS의 Connection Capacity에 도달했을 가능성이 높다고 판단했습니다.',
          '사실 확인을 위해 실제 max_connections를 조회한 결과 최대 연결 수가 79라는 것을 확인했으며, 현재 서비스별 DB Connection 구조를 확인했을 때 다음과 같이 이론상 최대 Connection 수가 RDS의 Connection Capacity를 초과할 수 있다는 것을 확인했습니다.',
        ])}
      </div>
      ${table({
        head: ['서비스', '최대 Task', 'Task당 Pool Max', '이론상 최대'],
        rows: [
          { cells: ['api-server', '1', '10', '10'], numVal: true },
          { cells: ['rule-worker', '9', '4', '36'], numVal: true },
          { cells: ['ai-worker', '20', '4', '80'], numVal: true },
          { cells: ['합계', '-', '-', '126'], numVal: true, highlight: true },
        ]
      })}
      <p class="body-text" style="margin-top:12px;">하지만 해당 문제를 해결하기 위해 RDS 인스턴스를 변경하거나 max_connections 자체를 늘리는 방향은 선택하지 않았습니다. RDS 인스턴스를 업그레이드하는 것은 추가적인 인프라 비용이 발생하며, 현재 구조처럼 각 서비스의 Connection 사용량 자체가 통제되지 않은 상태에서는 동일한 문제가 재발할 가능성이 있다고 판단했기 때문입니다.</p>
    `),

    // 05 개선 방향
    section(5, '개선 방향', `
      ${text('이번 Soak Test를 통해 장시간 부하 상황에서 DB 연결 수가 RDS의 Connection Capacity에 도달하여 FATAL 에러가 발생하는 것을 확인하였고, 이는 서비스별로 DB Connection 사용량이 적절히 통제되지 않았기 때문이라고 판단했습니다. 따라서 DB Connection 사용량을 재점검하여 Connection Pool 크기와 Task 수를 조정하는 방향으로 개선하기로 결정했습니다.')}
    `),
  ]
};
