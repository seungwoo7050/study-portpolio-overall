독립된 프로젝트들이 모여있는 저장소입니다.

backend/spring/
  - Spring Boot 기반 백엔드 서버 프로젝트

backend/node.js/
  - Node.js 기반 백엔드 서버 프로젝트

react/
    - React.js 기반 프론트엔드 프로젝트

game-server/
  - C++ 기반 게임 서버 프로젝트

video-editor/
    - node.js + react + c++/ffmpeg 기반 동영상 편집기 프로젝트

각 프로젝트의 design/ 폴더는 "전체 설계" 문서들을 포함하고 있습니다. 이 문서들은 항상 양방향으로 작성되었습니다. 즉, 전체 설계 문서에서 코드로 내려갈 수도 있고, 코드에서 전체 설계 문서로 올라올 수도 있습니다. 단지, 문서와 코드가 정합하기만 하면 됩니다.

각 프로젝트의 the-shortest-distance/ 폴더는 "모르는 것은 찾아보면서 구현한다"라는 모토를 위해, 적어도 첫 코드를 작성할 수 있도록 돕는 문서입니다.
모든 프로젝트의 the-shortest-distance/는 해당 프로젝트의 design/ 문서들을 참조하여 작성되어야합니다.

이번 작업 대상
backend/node.js/ N2.6 구현에 따른 design/ the-shortest-distance/ 문서 보강
 - RDB 전환 (SQLite → PostgreSQL 또는 MySQL)
 - Redis 캐시 도입 (인기 이슈 / 외부 API 캐시)
 - Docker & 클라우드 배포

 루트의 diff를 통해 2.6  diff를 확인할 수 있습니다. 이를통해 backend/node.js/ N2.6 구현에 따른 design/ the-shortest-distance/ 문서 보강작업을 진행해주세요.