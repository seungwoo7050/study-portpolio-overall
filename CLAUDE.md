## 독립된 프로젝트들이 모여있는 저장소입니다.
arena/
  - C++ 기반 멀티플레이어 게임 서버 프로젝트

backend/spring/
  - Spring Boot 기반 백엔드 서버 프로젝트

backend/node.js/
  - Node.js 기반 백엔드 서버 프로젝트

e-commerce/
  - 전체 전자상거래 시스템 프로젝트

frameworks/
  - 프레임워크의 저수준 구현 및 브릿지 프로젝트

game-server/
  - C++ 기반 게임 서버 프로젝트

ray-tracer/
  - C++ 기반 레이 트레이싱 렌더러 프로젝트

react/
    - React.js 기반 프론트엔드 프로젝트

video-editor/
    - node.js + react + c++/ffmpeg 기반 동영상 편집기 프로젝트

## about design/
각 프로젝트의 design/ 폴더는 "전체 설계" 문서들을 포함하고 있습니다. 이 문서들은 항상 양방향으로 작성되었습니다. 즉, 전체 설계 문서에서 코드로 내려갈 수도 있고, 코드에서 전체 설계 문서로 올라올 수도 있습니다. 단지, 문서와 코드가 정합하기만 하면 됩니다.
design/은 프로젝트에대한 상세한 설계도문서들을 담고있다. 얼마나 상세한지, 어떤 요소들을 언급하는지에 대해서는 기존에 작성된 game-server/design 를 참조. 문제는 우리는 현재 설계도를 작성하고 구현을하는것이아닌 구현된 소스코드를통해 설계도를 작성해내야한다는것.

### 작업과정에서 선택해야할 점:
game-server/gameserver-fundamentals/ 는 분명하게 각 lab이 독립된 프로젝트이며 때문에 1.1부터 1.4까지 4개의 디자인문서를 생성할 수 있었다.
gmae-server/netcode-core/는 각 버전이 독립되지않은 하나의 프로젝트지만 디자인 문서의 품질을 보장하기위해 0.x 버전단위로 작성되었다.
game-server/ 프로젝트들의 디자인문서만큼의 품질을 보장하려면 어떤 단위로 디자인문서를 작성해야할지 먼저 계획한 후 작업을 시작하세요.

## about the-shortest-distance/
각 프로젝트의 the-shortest-distance/ 폴더는 "모르는 것은 찾아보면서 구현한다"라는 모토를 위해, 적어도 첫 코드를 작성할 수 있도록 돕는 문서입니다.
모든 프로젝트의 the-shortest-distance/는 해당 프로젝트의 design/ 문서들을 참조하여 작성되어야합니다.

video-editor/design 는 완성상태. 예시로 활용.