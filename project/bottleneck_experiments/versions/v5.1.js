import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip, note } from '../components/render.js';

export default {
  version: 'v5.1',
  title: '',
  status: 'in progress',
  tags: [],
  prev: '5.0',
  next: null,

  sections: [

    // 01 운영 환경 구성
    section(1, '운영 환경 구성', `
      ${text('5.0버전에서 확인된 RDS Connection Capacity 문제를 개선하기 위해 DB Connection Pool 및 Task 수를 조정하였습니다. 최종 운영 환경은 다음과 같습니다.')}
      ${table({
        head: ['서비스', 'Task 수', 'Pool Max'],
        rows: [
          { cells: ['api-server', '1', '10'], numVal: true },
          { cells: ['rule-worker', '9', '4'], numVal: true },
          { cells: ['ai-worker', '9', '2'], numVal: true },
        ]
      })}
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      ${text('이전 버전에서 각 서비스별 Connection Pool 및 Task 구성을 조정하기로 결정함에 따라, 구체적인 Pool 및 Task 값을 결정하기 위해 애플리케이션이 사용할 수 있는 Connection 범위를 확인하고자 하였습니다.')}
      ${badge('Connection 사용 범위 확인', text([
        '서비스가 사용하는 DB Role의 rolconnlimit을 확인한 결과 -1로 설정되어 있어, Role 수준에서는 별도의 Connection 제한이 설정되어 있지 않음을 확인하였습니다. 또한 superuser_reserved_connections는 3으로 확인되었으나, 당시에는 RDS가 내부적으로 사용하는 connection 예약 영역의 정확한 크기를 확인하지 못했습니다. 따라서 max_connections 79에서 애플리케이션이 실제로 사용할 수 있는 Connection의 정확한 상한을 산정할 수 없었습니다.',
        '따라서 예약 영역의 크기를 임의로 추정하는 대신, 5.0버전 Soak Test에서 이미 확보한 실측 데이터를 기준으로 삼기로 하였습니다. 해당 데이터에서 DatabaseConnections가 48까지 상승하는 동안에는 FATAL이 발생하지 않았고, 73에 도달한 시점부터 FATAL이 발생하기 시작했습니다. 이를 근거로 안전/위험 구간을 판단하고 조정을 설계하였습니다.',
      ]))}
      ${badge('서비스별 조정 우선순위 결정', text([
        'rule-worker의 Auto Scaling은 처리량 확보보다 CPU 부하 분산을 위한 목적이 컸습니다. 실제로 5.0버전 Soak Test에서도 부하가 증가하며 rule-worker의 CPU가 높아지고 Task가 증가하면 CPU가 다시 낮아지는 동작이 확인되었기 때문에, Connection 사용량만을 이유로 rule-worker의 Task를 무리하게 축소하면 이미 해결한 CPU 병목이 재발할 가능성이 있다고 판단하여 조정을 보류하였습니다.',
        '반면 ai-worker는 Task 20 × Pool 4 = 80이라는 구성만으로도 max_connections 79를 초과할 수 있는 구조였고, 기존 실험(<a href="template.html?v=4.0#section-05" style="color:var(--blue); text-decoration:underline;">v4.0</a>)에서 외부 LLM Rate Limit으로 인해 Task를 늘려도 처리량이 비례해서 증가하지 않는다는 근거가 이미 있었습니다. 따라서 Task를 줄이더라도 처리량 손실이 크지 않을 것으로 판단하여 ai-worker를 우선 조정 대상으로 선정하였습니다.',
      ]))}
      ${badge('ai-worker의 task 및 pool 조정', `
        ${text('ai-worker의 조정 후보로는 Task와 Pool의 조합을 다음과 같이 검토하였습니다.')}
        ${table({
          head: ['후보', '이론상 최대 Connection', '조정방식'],
          rows: [
            { cells: ['8 Task × Pool 4', '32', 'Task만 축소'] },
            { cells: ['10 Task × Pool 3', '30', 'Task와 Pool을 함께 축소'] },
            { cells: ['15 Task × Pool 2', '30', 'Pool 중심으로 축소'] },
          ]
        })}
        <div style="margin-top:16px;">
          ${text('세 후보 모두 기존 구성(80) 대비 이론상 최대 Connection을 30개 내외로 낮출 수 있었습니다. 하지만 이 중 `10 × 3`은 Task 수와 Pool Max를 함께 축소하여 Connection 사용량을 줄이면서도 Task 수를 과도하게 줄이지 않아 Auto Scaling을 통한 확장이 가능하다고 판단하여 첫 조정값으로 선택하였습니다.')}
        </div>
      `)}
      ${badge('모니터링 보강', text([
        '마지막으로 조정 효과를 정확히 관측하기 위한 모니터링을 보강하였습니다. 기존에 사용하던 CloudWatch DatabaseConnections는 1분 평균값이며 전체 Connection 합계만 제공하기 때문에, 어느 서비스가 얼마나 Connection을 점유하는지 구분할 수 없었고 순간적인 변화도 놓칠 수 있었습니다.',
        '이를 보완하기 위해 PostgreSQL이 현재 서버에 연결된 각 세션의 상태와 접속 정보를 제공하는 시스템 뷰인 pg_stat_activity를 5초 주기로 조회하여 서비스별 Connection 수를 기록하는 모니터링을 추가로 구성하였습니다.',
        '이때 모니터링 과정에서 발생하는 Connection 점유를 최소화하기 위해 각 조회 시 Connection을 생성하여 조회를 수행한 후 즉시 반환하도록 구성하였습니다. 또한 Connection 확보에 실패한 경우에도 해당 결과를 별도로 기록하여 Connection 부족으로 인해 모니터링 데이터가 누락되는 상황 자체도 분석하도록 하였습니다.',
      ]))}
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${subLabel('1차 검증: Connection 여유 확보 여부 (Task 10 × Pool 3)', `
        ${text([
          '앞서 설계한 ai-worker Task 10 × Pool 3 구성이 실제로 Connection 여유를 만드는지 검증하기 위해 기존과 동일한 조건(50 VU, 30분 유지)에서 Soak Test를 수행하였습니다.',
        ])}
        ${imageUrl('../../assets/images/bottleneck_experiments/v12/v12-rds-db-connection-0809.png', '0809 Soak Test RDS DatabaseConnections 그래프')}
        ${note(`2026-08-09 07:35:42 UTC:172.31.22.212(54584):moodotclone_adm@postgres:[27165]:FATAL:  remaining connection slots are reserved for roles with privileges of the "rds_reserved" role<br>
... (총 125회 반복)<br>
<br>
2026-08-09 07:35:49 UTC:172.31.22.212(44588):moodotclone_adm@postgres:[27185]:FATAL:  remaining connection slots are reserved for roles with the SUPERUSER attribute<br>
... (총 32회 반복)`)}
        <div style="margin-top:16px;">
        ${text([
          '그 결과 FATAL은 2,576건에서 157건으로 94% 감소하였고, 그중 too many clients already 오류는 8건에서 0건으로 완전히 사라졌습니다. 하지만 FATAL 발생이 감소한 것과는 달리 Connection 사용량은 여전히 높은 수준으로 유지되고 있었습니다. CloudWatch DatabaseConnections에서는 1분 평균값이 약 70 수준까지 상승하는 양상이 확인되었으며, 5초 단위로 관측한 pg_stat_activity 기반 모니터링에서는 순간 Connection 수가 최대 78까지 증가하는 것을 확인하였습니다. 또한 발생한 FATAL 중 32건은 일반 Connection을 모두 사용한 이후 SUPERUSER 예약 영역까지 사용하게 된 경우로 확인되었습니다.',
          '따라서 FATAL 발생 건수는 크게 감소하였지만 Connection 여유가 충분히 확보된 것은 아니며 여전히 Connection Capacity에 근접한 상태라고 판단하였습니다.',
        ])}
        </div>
      `)}
      ${subLabel('2차 검증: Connection 여유 확보 여부 (Task 9 × Pool 3)', `
        ${text([
          '1차 검증 결과에 따라 ai-worker의 Task를 10에서 9까지 추가로 축소하고 Pool Max는 3으로 유지하여 동일한 조건으로 Soak Test를 다시 수행하였습니다.',
        ])}
        ${imageUrl('../../assets/images/bottleneck_experiments/v12/v12-rds-db-connection-0810.png', '0810 Soak Test RDS DatabaseConnections 그래프')}
        ${note(`2026-08-10 11:03:27 UTC:172.31.22.212(42206):moodotclone_adm@postgres:[2884]:FATAL:  remaining connection slots are reserved for roles with privileges of the "rds_reserved" role<br>
... (총 125회 반복)`)}
        <div style="margin-top:16px;">
        ${text([
          '그 결과 SUPERUSER 예약 영역 관련 FATAL은 32건에서 0건으로 감소하였지만, 5초 단위로 관측한 Connection 수의 순간 최댓값은 78에서 80으로 증가하였으며 총 125건의 FATAL이 발생하였습니다.',
          '발생 시점을 확인한 결과, ai-worker와 rule-worker가 같은 시각(20:03)에 동시에 Auto Scaling 상한에 도달하였고, 약 1초 뒤 FATAL이 발생하는 것을 확인했습니다. 해당 시점 두 Worker의 최대 Task 수를 기준으로 이론상 최대 Connection을 계산하면 api-server 10 + rule-worker 36 + ai-worker 27 = 73으로 max_connection = 79에 여전히 근접하고 있다는 것도 확인할 수 있었습니다.',
          '이를 통해 Task를 추가로 축소하는 것만으로는 Connection 여유를 확보하는데에 한계가 있다고 판단하였습니다.',
        ])}
        </div>
      `)}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${text('')}
    `),

    // 05 판단 및 이유
    section(5, '판단 및 이유', `
      ${text('')}
    `),

    // 06 개선 방향
    section(6, '개선 방향', `
      ${text('')}
    `),
  ]
};
