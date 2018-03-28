import { JwtService } from "./jwtservice";
import { DefaultInjector } from "../../../../../ioc/injector";
class $JwtServiceActivator {
    instance;
    activate() {
        if (this.instance === undefined) {
            this.instance = new JwtService();
        }
        return this.instance;
    }
}
DefaultInjector.addActivator(JwtService, new $JwtServiceActivator());
